import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { randomUUID } from "crypto";
import {
  EVENTS,
  Room,
  Player,
  ArenaState,
  LeaderboardEntry,
  CreateRoomPayload,
  JoinRoomPayload,
  LeaveRoomPayload,
  ToggleReadyPayload,
  PlayAgainPayload,
  GameInputPayload,
  GameSyncPayload,
} from "@arena/shared";
import { REGISTRY, nextFromDeck, freshDeck } from "./games/registry";

import path from "path";

const PORT = Number(process.env.PORT) || 3001;
const MAX_PLAYERS = 12;
const WIN_SCORE = 10;
const RESULT_DELAY_MS = 10000;

const app = express();
app.use(cors());
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));

if (process.env.NODE_ENV === "production") {
  const webDist = path.resolve(__dirname, "../../web/dist");
  app.use(express.static(webDist));
  app.get("*", (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// ── State maps ───────────────────────────────────────────────────────────────

const rooms      = new Map<string, Room>();
const arenas     = new Map<string, ArenaState>();
const benchIdx   = new Map<string, number>();
const gameDecks  = new Map<string, string[]>(); // per-room shuffled game deck
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gameStates = new Map<string, any>();
const gameTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function freshArena(): ArenaState {
  return { phase: "LOBBY", duel: null, benchedId: null, gameId: 0, startedAt: null, endsAt: null, gameMeta: null, lastResult: null, lastGameResult: null };
}

function generateRoomCode(): string {
  let code: string;
  do { code = String(Math.floor(Math.random() * 10000)).padStart(4, "0"); }
  while (rooms.has(code));
  return code;
}

function leaderboard(room: Room): LeaderboardEntry[] {
  return [...room.players].sort((a, b) => b.score - a.score)
    .map(({ id, name, score }) => ({ id, name, score }));
}

function broadcastArena(roomCode: string) {
  const room  = rooms.get(roomCode);
  const arena = arenas.get(roomCode);
  if (room && arena) io.to(roomCode).emit(EVENTS.ARENA_UPDATE, { room, arena });
}

function broadcastGameState(roomCode: string) {
  const arena = arenas.get(roomCode);
  if (!arena?.duel) return;
  const def   = REGISTRY.get(arena.duel.gameDefId);
  const state = gameStates.get(roomCode);
  if (!def || !state) return;
  const remainingMs = arena.endsAt ? Math.max(0, arena.endsAt - Date.now()) : 0;
  // Emit to the whole Socket.IO room — matchId lets clients discard stale events
  io.to(roomCode).emit(EVENTS.GAME_STATE, {
    roomCode,
    matchId: arena.duel.matchId,
    gameId: arena.gameId,
    gameDefId: arena.duel.gameDefId,
    publicState: def.publicState(state),
    remainingMs,
  });
}

function clearGameTimer(roomCode: string) {
  const t = gameTimers.get(roomCode);
  if (t) { clearTimeout(t); gameTimers.delete(roomCode); }
}

// Games that auto-resolve when a winner is found before time expires (v===1 check)
// All games with "wait for both" or custom logic use isResolved?() on GameDefinition instead
// All games now use isResolved?() or run to timer expiry — nothing needs the early-resolve speculative check
const EARLY_RESOLVE_GAMES = new Set<string>([
  // reaction_green — moved to isResolved?()
  // quick_maths, emoji_odd_one_out, memory_grid — wait for both players, use isResolved?()
  // higher_lower, rock_paper_scissors, tic_tac_toe — use isResolved?()
  // whack_a_logo, tapping_speed, stop_at_10s — run to time expiry
]);

function resolveGame(roomCode: string) {
  clearGameTimer(roomCode);
  const room  = rooms.get(roomCode);
  const arena = arenas.get(roomCode);
  if (!room || !arena || !arena.duel) return;

  const def   = REGISTRY.get(arena.duel.gameDefId);
  const state = gameStates.get(roomCode);
  if (!def || !state) return;

  const result = def.resolve(state);
  gameStates.delete(roomCode);

  io.to(roomCode).emit(EVENTS.GAME_RESULT, {
    roomCode,
    matchId: arena.duel.matchId,
    gameId: arena.gameId,
    gameDefId: arena.duel.gameDefId,
    result,
  });

  const { aId, bId } = arena.duel;
  const deltaScores: Record<string, number> = { [aId]: 0, [bId]: 0 };
  for (const [id, outcome] of Object.entries(result.outcomeByPlayerId)) {
    deltaScores[id] = outcome as number;
  }
  for (const p of room.players) {
    if (p.id in deltaScores) p.score += deltaScores[p.id];
  }

  const topOutcome = Math.max(...Object.values(result.outcomeByPlayerId) as number[]);
  const arenaWinners = Object.entries(result.outcomeByPlayerId).filter(([, v]) => v === topOutcome);
  const isDraw = arenaWinners.length > 1;
  const winnerId = isDraw ? null : arenaWinners[0][0];

  const lb = leaderboard(room);
  arena.phase = "RESULT";
  arena.lastResult = { winnerId, isDraw, deltaScores, leaderboard: lb };
  arena.lastGameResult = {
    roomCode,
    matchId: arena.duel.matchId,
    gameId: arena.gameId,
    gameDefId: arena.duel.gameDefId,
    result,
  };
  broadcastArena(roomCode);
  // Keep separate events for clients that may catch them
  io.to(roomCode).emit(EVENTS.DUEL_RESULT, { winnerId, isDraw, deltaScores, leaderboard: lb });

  const champion = room.players.find((p) => p.score >= WIN_SCORE);
  if (champion) {
    arena.phase = "FINISHED";
    broadcastArena(roomCode);
    return;
  }

  const t = setTimeout(() => {
    const r = rooms.get(roomCode);
    const a = arenas.get(roomCode);
    if (!r || !a || a.phase !== "RESULT") return;
    scheduleDuel(roomCode);
  }, RESULT_DELAY_MS);
  gameTimers.set(roomCode, t);
}

function scheduleDuel(roomCode: string) {
  const room    = rooms.get(roomCode)!;
  const arena   = arenas.get(roomCode)!;
  const players = room.players;
  if (players.length < 2) return;

  let benchedId: string | null = null;
  if (players.length % 2 !== 0) {
    const prev = benchIdx.get(roomCode) ?? -1;
    const nextBenchPos = (prev + 1) % players.length;
    benchIdx.set(roomCode, nextBenchPos);
    benchedId = players[nextBenchPos].id;
  }

  const duelers = players.filter((p) => p.id !== benchedId);
  const aId = duelers[0].id;
  const bId = duelers[1].id;
  for (const p of players) p.isReady = p.id === benchedId;

  // Pull next game from per-room deck; auto-reshuffles when exhausted
  if (!gameDecks.has(roomCode)) gameDecks.set(roomCode, freshDeck());
  const gameDef = nextFromDeck(gameDecks.get(roomCode)!);

  const matchId = randomUUID();

  arena.phase          = "PRE_ROUND";
  arena.duel           = { aId, bId, gameDefId: gameDef.id, matchId };
  arena.gameMeta       = {
    gameDefId: gameDef.id,
    displayName: gameDef.displayName,
    instructions: gameDef.instructions,
    durationMs: gameDef.durationMs,
  };
  arena.benchedId      = benchedId;
  arena.gameId        += 1;
  arena.startedAt      = null;
  arena.endsAt         = null;
  arena.lastResult     = null;
  arena.lastGameResult = null;

  broadcastArena(roomCode);
}

function startGame(roomCode: string) {
  const arena = arenas.get(roomCode);
  if (!arena?.duel) return;
  const def = REGISTRY.get(arena.duel.gameDefId);
  if (!def) return;

  const now = Date.now();
  arena.phase     = "DUELING";
  arena.startedAt = now;
  arena.endsAt    = now + def.durationMs;

  const state = def.init([arena.duel.aId, arena.duel.bId]);
  gameStates.set(roomCode, state);

  // Phase update first, then initial game state immediately so both players
  // receive it simultaneously and no one starts with a blank screen
  broadcastArena(roomCode);
  broadcastGameState(roomCode);
  // Re-broadcast after 150ms to reduce mount-race missed events
  setTimeout(() => { broadcastArena(roomCode); broadcastGameState(roomCode); }, 150);

  const t = setTimeout(() => resolveGame(roomCode), def.durationMs);
  gameTimers.set(roomCode, t);
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on(EVENTS.CREATE_ROOM, (payload: CreateRoomPayload) => {
    const name = (payload?.name ?? "").trim();
    if (!name) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_name_required", messageText: "Name is required." });
      return;
    }
    const roomCode = generateRoomCode();
    const player: Player = { id: socket.id, name, isReady: false, score: 0 };
    const room: Room = { id: roomCode, hostId: socket.id, players: [player], createdAt: Date.now() };
    rooms.set(roomCode, room);
    arenas.set(roomCode, freshArena());
    socket.join(roomCode);
    socket.emit(EVENTS.ROOM_JOINED, { roomCode, playerId: socket.id, room });
    console.log(`[room:create] ${roomCode} by "${name}"`);
  });

  socket.on(EVENTS.JOIN_ROOM, (payload: JoinRoomPayload) => {
    const name     = (payload?.name ?? "").trim();
    const roomCode = (payload?.roomCode ?? "").trim();
    if (!name) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_name_required", messageText: "Name is required." });
      return;
    }
    if (!/^\d{4}$/.test(roomCode)) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_invalid_code", messageText: "Room code must be 4 digits." });
      return;
    }
    const room  = rooms.get(roomCode);
    const arena = arenas.get(roomCode);
    if (!room || !arena) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_not_found", messageText: "Room not found." });
      return;
    }
    if (room.players.length >= MAX_PLAYERS) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_full", messageText: "Room is full." });
      return;
    }
    const player: Player = { id: socket.id, name, isReady: false, score: 0 };
    room.players.push(player);
    socket.join(roomCode);
    socket.emit(EVENTS.ROOM_JOINED, { roomCode, playerId: socket.id, room });
    socket.emit(EVENTS.ARENA_UPDATE, { room, arena });
    socket.to(roomCode).emit(EVENTS.ROOM_UPDATE, { room });
    console.log(`[room:join] ${roomCode} by "${name}"`);
  });

  socket.on(EVENTS.LEAVE_ROOM, (payload: LeaveRoomPayload) => {
    handleLeave(socket.id, payload?.roomCode, "explicit");
  });

  socket.on(EVENTS.TOGGLE_READY, (payload: ToggleReadyPayload) => {
    const room  = rooms.get(payload?.roomCode ?? "");
    const arena = arenas.get(payload?.roomCode ?? "");
    if (!room || !arena) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    if (arena.phase === "LOBBY") {
      player.isReady = !player.isReady;
      const allReady = room.players.length >= 2 && room.players.every((p) => p.isReady);
      if (allReady) { benchIdx.delete(room.id); scheduleDuel(room.id); return; }
      broadcastArena(room.id);
      return;
    }

    if (arena.phase === "PRE_ROUND") {
      if (!arena.duel) return;
      if (player.id !== arena.duel.aId && player.id !== arena.duel.bId) return;
      player.isReady = true;
      const duelA = room.players.find((p) => p.id === arena.duel!.aId);
      const duelB = room.players.find((p) => p.id === arena.duel!.bId);
      if (duelA?.isReady && duelB?.isReady) { startGame(room.id); return; }
      broadcastArena(room.id);
    }
  });

  socket.on(EVENTS.GAME_INPUT, (payload: GameInputPayload) => {
    const roomCode = (payload?.roomCode ?? "").trim();
    const arena    = arenas.get(roomCode);
    if (!arena || arena.phase !== "DUELING" || !arena.duel) return;
    if (socket.id !== arena.duel.aId && socket.id !== arena.duel.bId) return;

    const def   = REGISTRY.get(arena.duel.gameDefId);
    const state = gameStates.get(roomCode);
    if (!def || !state) return;

    const newState = def.input(state, socket.id, payload.payload);
    gameStates.set(roomCode, newState);
    broadcastGameState(roomCode);

    // Send per-player private updates (e.g. hidden hints in higher_lower)
    if (def.privateUpdate) {
      for (const id of [arena.duel.aId, arena.duel.bId]) {
        const priv = def.privateUpdate(newState, id);
        if (priv != null) {
          io.to(id).emit(EVENTS.GAME_PRIVATE, {
            matchId: arena.duel.matchId,
            gameId: arena.gameId,
            data: priv,
          });
        }
      }
    }

    // Custom resolution check (games with complex logic, e.g. round-based or sub-round games)
    if (def.isResolved?.(newState)) { resolveGame(roomCode); return; }

    // Standard early-resolve for simple winner-detection games
    if (EARLY_RESOLVE_GAMES.has(arena.duel.gameDefId)) {
      const resolved = def.resolve(newState);
      const hasWinner = Object.values(resolved.outcomeByPlayerId).some((v) => v === 1);
      if (hasWinner) resolveGame(roomCode);
    }
  });

  socket.on(EVENTS.GAME_SYNC, (payload: GameSyncPayload) => {
    const roomCode = (payload?.roomCode ?? "").trim();
    const room     = rooms.get(roomCode);
    const arena    = arenas.get(roomCode);

    console.log(`[game:sync] room=${roomCode} socket=${socket.id} phase=${arena?.phase ?? "none"} matchId=${arena?.duel?.matchId ?? "none"}`);

    // Room not found — nothing to do
    if (!room) return;

    // Always push current arena so client has the right phase/matchId
    if (arena) socket.emit(EVENTS.ARENA_UPDATE, { room, arena });

    // Only emit game state when actively dueling with a live game state
    if (!arena || arena.phase !== "DUELING" || !arena.duel) return;

    const def   = REGISTRY.get(arena.duel.gameDefId);
    const state = gameStates.get(roomCode);
    if (!def || !state) return;

    const remainingMs = arena.endsAt ? Math.max(0, arena.endsAt - Date.now()) : 0;
    console.log(`[game:sync] emitting GAME_STATE room=${roomCode} socket=${socket.id} matchId=${arena.duel.matchId}`);
    socket.emit(EVENTS.GAME_STATE, {
      roomCode,
      matchId: arena.duel.matchId,
      gameId: arena.gameId,
      gameDefId: arena.duel.gameDefId,
      publicState: def.publicState(state),
      remainingMs,
    });
  });

  socket.on(EVENTS.PLAY_AGAIN, (payload: PlayAgainPayload) => {
    const room  = rooms.get(payload?.roomCode ?? "");
    const arena = arenas.get(payload?.roomCode ?? "");
    if (!room || !arena || arena.phase !== "FINISHED") return;
    for (const p of room.players) { p.score = 0; p.isReady = false; }
    benchIdx.delete(room.id);
    clearGameTimer(room.id);
    gameStates.delete(room.id);
    gameDecks.delete(room.id); // reset deck for a fresh shuffle next session
    arenas.set(room.id, freshArena());
    broadcastArena(room.id);
  });

  socket.on("disconnect", () => {
    handleLeave(socket.id);
    console.log(`[disconnect] ${socket.id}`);
  });
});

function handleLeave(socketId: string, roomCode?: string, reason: "explicit" | "disconnect" = "disconnect") {
  const targets = roomCode
    ? ([rooms.get(roomCode)].filter(Boolean) as Room[])
    : [...rooms.values()];

  for (const room of targets) {
    const idx = room.players.findIndex((p) => p.id === socketId);
    if (idx === -1) continue;
    room.players.splice(idx, 1);
    console.log(`[handleLeave] room=${room.id} socket=${socketId} reason=${reason}`);

    if (room.players.length === 0) {
      rooms.delete(room.id);
      arenas.delete(room.id);
      benchIdx.delete(room.id);
      gameDecks.delete(room.id);
      clearGameTimer(room.id);
      gameStates.delete(room.id);
    } else {
      if (room.hostId === socketId) room.hostId = room.players[0].id;
      const arena = arenas.get(room.id)!;
      if (arena.phase === "PRE_ROUND" || arena.phase === "DUELING") {
        const duelIds = [arena.duel?.aId, arena.duel?.bId];
        if (duelIds.includes(socketId)) {
          console.log(`[handleLeave] duel reset — room=${room.id} socket=${socketId} was dueling`);
          clearGameTimer(room.id);
          gameStates.delete(room.id);
          for (const p of room.players) p.isReady = false;
          arenas.set(room.id, { ...freshArena(), gameId: arena.gameId });
        }
      }
      broadcastArena(room.id);
    }
    break;
  }
}

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
