import { Server } from "socket.io";
import type {
  Room,
  Player,
  ArenaState,
  ArenaDuel,
  RoundDuel,
  LeaderboardEntry,
} from "@arena/shared";
import { EVENTS } from "@arena/shared";
import {
  rooms, arenas, benchCounts, lastBenched, gameDecks, lastGameDefIds,
  resolvedDuels, socketRooms, socketPlayers, playerSockets,
  socketOf,
} from "./state";
import { persistRoom, persistArena } from "./redis";
import { REGISTRY, nextFromDeck, freshDeck } from "./games/registry";
import { randomUUID } from "crypto";
import { clearAllGameTimers } from "./gameEngine";

export const WIN_SCORE = 10;
export const RESULT_DELAY_MS = 6000;
export const COUNTDOWN_MS = 3000;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function generateRoomCode(): string {
  let code: string;
  do { code = String(Math.floor(Math.random() * 10000)).padStart(4, "0"); }
  while (rooms.has(code));
  return code;
}

export function leaderboard(room: Room): LeaderboardEntry[] {
  return [...room.players].sort((a, b) => b.score - a.score)
    .map(({ id, name, score }) => ({ id, name, score }));
}

export function freshArena(): ArenaState {
  return {
    phase: "LOBBY", duel: null, duels: [], benchedId: null,
    gameId: 0, startedAt: null, endsAt: null, countdownStartAt: null,
    gameMeta: null, lastResult: null, lastGameResult: null,
  };
}

// ── Broadcast helpers ─────────────────────────────────────────────────────────

export function broadcastArena(roomCode: string, io: Server): void {
  const room  = rooms.get(roomCode);
  const arena = arenas.get(roomCode);
  if (room && arena) io.to(roomCode).emit(EVENTS.ARENA_UPDATE, { room, arena });
}

/** Emit ARENA_UPDATE to each player with their personal `duel` field set. */
export function emitRoundUpdate(roomCode: string, io: Server): void {
  const room  = rooms.get(roomCode);
  const arena = arenas.get(roomCode);
  if (!room || !arena) return;
  for (const player of room.players) {
    const sid = socketOf(player.id);
    if (!sid) continue;
    const playerDuel = arena.duels.find((d) => d.aId === player.id || d.bId === player.id) ?? null;
    io.to(sid).emit(EVENTS.ARENA_UPDATE, { room, arena: { ...arena, duel: playerDuel } });
  }
}

// ── Eviction ──────────────────────────────────────────────────────────────────

/** Evict a socket from its current room before joining a new one. */
export function evictFromPreviousRoom(socketId: string, io: Server): void {
  const prev = socketRooms.get(socketId);
  if (!prev) return;
  const playerId = socketPlayers.get(socketId);
  console.log(`[evict] socket=${socketId} playerId=${playerId ?? "?"} leaving previous room=${prev}`);
  const sockets = io.sockets.sockets.get(socketId);
  sockets?.leave(prev);
  socketRooms.delete(socketId);
  if (playerId) handleLeave(playerId, prev, "evict", io);
}

// ── Fair bench selection ──────────────────────────────────────────────────────

function chooseBenched(roomCode: string, players: Player[]): string {
  let counts = benchCounts.get(roomCode);
  if (!counts) {
    counts = new Map(players.map((p) => [p.id, 0]));
    benchCounts.set(roomCode, counts);
  } else {
    for (const p of players) {
      if (!counts.has(p.id)) counts.set(p.id, 0);
    }
  }
  const last = lastBenched.get(roomCode);
  let candidates = players.filter((p) => p.id !== last);
  if (candidates.length === 0) candidates = players;
  const minCount = Math.min(...candidates.map((p) => counts!.get(p.id) ?? 0));
  const eligible = candidates.filter((p) => (counts!.get(p.id) ?? 0) === minCount);
  return eligible[Math.floor(Math.random() * eligible.length)].id;
}

// ── Round scheduler ───────────────────────────────────────────────────────────

export function scheduleRound(roomCode: string, io: Server): void {
  const room    = rooms.get(roomCode)!;
  const arena   = arenas.get(roomCode)!;
  const players = room.players;
  if (players.length < 2) return;

  // Ensure bench counts exist for all current players
  let counts = benchCounts.get(roomCode);
  if (!counts) {
    counts = new Map(players.map((p) => [p.id, 0]));
    benchCounts.set(roomCode, counts);
  } else {
    for (const p of players) {
      if (!counts.has(p.id)) counts.set(p.id, 0);
    }
  }

  // Choose benched player (only if odd count)
  let benchedId: string | null = null;
  if (players.length % 2 !== 0) {
    benchedId = chooseBenched(roomCode, players);
    counts.set(benchedId, (counts.get(benchedId) ?? 0) + 1);
    lastBenched.set(roomCode, benchedId);
  } else {
    lastBenched.delete(roomCode);
  }

  const duelers = players.filter((p) => p.id !== benchedId);

  // Fisher-Yates shuffle for random pairing
  for (let i = duelers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [duelers[i], duelers[j]] = [duelers[j], duelers[i]];
  }

  // Same game for all duels in this round — never repeat the last game played
  if (!gameDecks.has(roomCode)) gameDecks.set(roomCode, freshDeck());
  const gameDef = nextFromDeck(gameDecks.get(roomCode)!, lastGameDefIds.get(roomCode));
  lastGameDefIds.set(roomCode, gameDef.id);
  const gameMeta = {
    gameDefId: gameDef.id,
    displayName: gameDef.displayName,
    instructions: gameDef.instructions,
    durationMs: gameDef.durationMs,
  };

  // Create k = floor(N/2) concurrent duels
  const newDuels: RoundDuel[] = [];
  for (let i = 0; i < duelers.length; i += 2) {
    newDuels.push({
      aId: duelers[i].id,
      bId: duelers[i + 1].id,
      gameDefId: gameDef.id,
      matchId: randomUUID(),
      gameMeta,
    });
  }

  // Reset player ready states — benched starts ready
  for (const p of players) p.isReady = p.id === benchedId;

  arena.phase            = "PRE_ROUND";
  arena.duels            = newDuels;
  arena.duel             = null; // populated per-player in emitRoundUpdate
  arena.gameMeta         = gameMeta;
  arena.benchedId        = benchedId;
  arena.gameId          += 1;
  arena.startedAt        = null;
  arena.endsAt           = null;
  arena.countdownStartAt = null;
  arena.lastResult       = null;
  arena.lastGameResult   = null;

  resolvedDuels.set(roomCode, new Set());
  persistRoom(roomCode, room);
  persistArena(roomCode, arena);
  emitRoundUpdate(roomCode, io);
}

// ── Round start (after countdown) ────────────────────────────────────────────
// Note: startDuelGame is in gameEngine.ts; imported dynamically to avoid circular dep.

export function startRound(roomCode: string, io: Server): void {
  const arena = arenas.get(roomCode);
  if (!arena || arena.duels.length === 0) return;

  arena.countdownStartAt = Date.now();
  emitRoundUpdate(roomCode, io);

  // Imported here to break circular dep: roomManager ↔ gameEngine
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { startDuelGame } = require("./gameEngine") as typeof import("./gameEngine");

  const roundKey = `round:${roomCode}`;
  // Import gameTimers to set the countdown timer
  const { gameTimers } = require("./state") as typeof import("./state");
  const t = setTimeout(() => {
    const a = arenas.get(roomCode);
    if (!a || a.phase !== "PRE_ROUND") return;
    const now = Date.now();
    a.phase = "DUELING";
    a.startedAt = now;
    const durationMs = REGISTRY.get(a.duels[0]?.gameDefId ?? "")?.durationMs ?? 10000;
    a.endsAt = now + durationMs;
    emitRoundUpdate(roomCode, io);
    for (const d of a.duels) {
      startDuelGame(roomCode, d, a.endsAt, a.gameId, io);
    }
    persistArena(roomCode, a);
  }, COUNTDOWN_MS);
  gameTimers.set(roundKey, t);
}

// ── Player leave ──────────────────────────────────────────────────────────────

export function handleLeave(
  playerId: string,
  roomCode?: string,
  reason: "explicit" | "disconnect" | "evict" = "disconnect",
  io?: Server,
): void {
  const targets = roomCode
    ? ([rooms.get(roomCode)].filter(Boolean) as Room[])
    : [...rooms.values()];

  for (const room of targets) {
    const idx = room.players.findIndex((p) => p.id === playerId);
    if (idx === -1) continue;
    room.players.splice(idx, 1);
    console.log(`[handleLeave] room=${room.id} playerId=${playerId} reason=${reason}`);

    if (room.players.length === 0) {
      rooms.delete(room.id);
      arenas.delete(room.id);
      benchCounts.delete(room.id);
      lastBenched.delete(room.id);
      gameDecks.delete(room.id);
      lastGameDefIds.delete(room.id);
      clearAllGameTimers(room.id);
      resolvedDuels.delete(room.id);
    } else {
      if (room.hostId === playerId) room.hostId = room.players[0].id;
      const arena = arenas.get(room.id)!;
      if (arena.phase === "PRE_ROUND" || arena.phase === "DUELING") {
        const wasInDuel = arena.duels.some((d) => d.aId === playerId || d.bId === playerId);
        if (wasInDuel) {
          console.log(`[handleLeave] round reset — room=${room.id} playerId=${playerId} was dueling`);
          clearAllGameTimers(room.id);
          resolvedDuels.delete(room.id);
          for (const p of room.players) p.isReady = false;
          arenas.set(room.id, { ...freshArena(), gameId: arena.gameId });
          if (io) broadcastArena(room.id, io);
          persistArena(room.id, arenas.get(room.id)!);
          break;
        }
      }
      if (io) broadcastArena(room.id, io);
      persistRoom(room.id, room);
    }
    break;
  }
}

// ── Player ID assignment ──────────────────────────────────────────────────────

/** Assign a stable UUID as player.id (separate from socket.id). */
export function createPlayerId(): string {
  return randomUUID();
}

/** Register socket ↔ player ↔ room mappings after a successful join/create. */
export function registerSocket(socketId: string, playerId: string, roomCode: string): void {
  playerSockets.set(playerId, socketId);
  socketPlayers.set(socketId, playerId);
  socketRooms.set(socketId, roomCode);
}

/** Deregister socket mappings (not player mappings — those survive disconnect for 30s). */
export function deregisterSocket(socketId: string): { playerId?: string; roomCode?: string } {
  const playerId = socketPlayers.get(socketId);
  const roomCode = socketRooms.get(socketId);
  socketPlayers.delete(socketId);
  socketRooms.delete(socketId);
  if (playerId) playerSockets.delete(playerId);
  return { playerId, roomCode };
}

// ── ArenaDuel personalized helper ─────────────────────────────────────────────

export function personalDuel(arena: ArenaState, playerId: string): ArenaDuel | null {
  return arena.duels.find((d) => d.aId === playerId || d.bId === playerId) ?? null;
}
