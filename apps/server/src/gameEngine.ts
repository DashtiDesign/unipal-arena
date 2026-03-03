import { Server } from "socket.io";
import type { ArenaDuel, RoundDuel, LeaderboardEntry } from "@arena/shared";
import { EVENTS } from "@arena/shared";
import {
  rooms, arenas, gameStates, gameTimers, bombTimers, resolvedDuels, socketOf,
} from "./state";
import { persistArena, persistGameState } from "./redis";
import { REGISTRY } from "./games/registry";
import { bombExpiresIn } from "./games/whackALogo";
import { WIN_SCORE, RESULT_DELAY_MS, leaderboard, scheduleRound, emitRoundUpdate, freshArena } from "./roomManager";

// ── Broadcast ─────────────────────────────────────────────────────────────────

export function broadcastGameStateForDuel(
  matchId: string, roomCode: string, duel: ArenaDuel, endsAt: number, gameId: number, io: Server,
): void {
  const def   = REGISTRY.get(duel.gameDefId);
  const state = gameStates.get(matchId);
  if (!def || !state) return;
  const remainingMs = Math.max(0, endsAt - Date.now());
  io.to(roomCode).emit(EVENTS.GAME_STATE, {
    roomCode,
    matchId: duel.matchId,
    gameId,
    gameDefId: duel.gameDefId,
    publicState: def.publicState(state),
    remainingMs,
  });
}

// ── Timer helpers ─────────────────────────────────────────────────────────────

export function clearDuelTimer(matchId: string): void {
  const t = gameTimers.get(matchId);
  if (t) { clearTimeout(t); gameTimers.delete(matchId); }
  // Clear any pending bomb-expiry timers for this match
  for (const key of [...bombTimers.keys()]) {
    if (key.startsWith(`${matchId}:`)) {
      clearTimeout(bombTimers.get(key));
      bombTimers.delete(key);
    }
  }
}

export function clearRoundTimer(roomCode: string): void {
  const key = `round:${roomCode}`;
  const t = gameTimers.get(key);
  if (t) { clearTimeout(t); gameTimers.delete(key); }
}

export function clearAllGameTimers(roomCode: string): void {
  clearRoundTimer(roomCode);
  const arena = arenas.get(roomCode);
  if (arena) {
    for (const d of arena.duels) {
      clearDuelTimer(d.matchId);
      gameStates.delete(d.matchId);
    }
  }
}

// ── Per-duel resolve ──────────────────────────────────────────────────────────

export function resolveDuel(roomCode: string, duel: RoundDuel, io: Server): void {
  const matchId = duel.matchId;

  // Double-resolve guard — must be first
  let resolved = resolvedDuels.get(roomCode);
  if (!resolved) { resolved = new Set(); resolvedDuels.set(roomCode, resolved); }
  if (resolved.has(matchId)) return;
  resolved.add(matchId);

  clearDuelTimer(matchId);

  const room  = rooms.get(roomCode);
  const arena = arenas.get(roomCode);
  if (!room || !arena) return;

  const def   = REGISTRY.get(duel.gameDefId);
  const state = gameStates.get(matchId);
  if (!def || !state) return;

  const result = def.resolve(state);
  gameStates.delete(matchId);

  io.to(roomCode).emit(EVENTS.GAME_RESULT, {
    roomCode,
    matchId,
    gameId: arena.gameId,
    gameDefId: duel.gameDefId,
    result,
  });

  // Apply delta scores
  const deltaScores: Record<string, number> = { [duel.aId]: 0, [duel.bId]: 0 };
  for (const [id, outcome] of Object.entries(result.outcomeByPlayerId)) {
    deltaScores[id] = outcome as number;
  }
  for (const p of room.players) {
    if (p.id in deltaScores) p.score += deltaScores[p.id];
  }

  // Check if ALL duels in this round are resolved
  if (!arena.duels.every((d) => resolved!.has(d.matchId))) return;

  // All duels done — transition to RESULT
  resolvedDuels.delete(roomCode);
  const lb: LeaderboardEntry[] = leaderboard(room);
  const topOutcome = Math.max(...Object.values(result.outcomeByPlayerId) as number[]);
  const arenaWinners = Object.entries(result.outcomeByPlayerId).filter(([, v]) => v === topOutcome);
  const isDraw = arenaWinners.length > 1;
  const winnerId = isDraw ? null : arenaWinners[0][0];

  arena.phase = "RESULT";
  arena.lastResult = { winnerId, isDraw, deltaScores, leaderboard: lb };
  arena.lastGameResult = {
    roomCode,
    matchId,
    gameId: arena.gameId,
    gameDefId: duel.gameDefId,
    result,
  };

  // Personalized ARENA_UPDATE for RESULT (duel field shows player's own duel)
  for (const player of room.players) {
    const sid = socketOf(player.id);
    if (!sid) continue;
    const playerDuel = arena.duels.find((d) => d.aId === player.id || d.bId === player.id) ?? null;
    io.to(sid).emit(EVENTS.ARENA_UPDATE, { room, arena: { ...arena, duel: playerDuel } });
  }
  io.to(roomCode).emit(EVENTS.DUEL_RESULT, { winnerId, isDraw, deltaScores, leaderboard: lb });
  persistArena(roomCode, arena);

  const champion = room.players.find((p) => p.score >= WIN_SCORE);
  const roundKey = `round:${roomCode}`;
  const t = setTimeout(() => {
    const r = rooms.get(roomCode);
    const a = arenas.get(roomCode);
    if (!r || !a || a.phase !== "RESULT") return;
    if (champion) {
      a.phase = "FINISHED";
      io.to(roomCode).emit(EVENTS.ARENA_UPDATE, { room: r, arena: a });
      persistArena(roomCode, a);
    } else {
      scheduleRound(roomCode, io);
    }
  }, RESULT_DELAY_MS);
  gameTimers.set(roundKey, t);
}

// ── Per-duel game start ───────────────────────────────────────────────────────

export function startDuelGame(
  roomCode: string, duel: RoundDuel, endsAt: number, gameId: number, io: Server,
): void {
  const def = REGISTRY.get(duel.gameDefId);
  if (!def) return;
  const state = def.init([duel.aId, duel.bId]);
  gameStates.set(duel.matchId, state);
  persistGameState(duel.matchId, state);
  broadcastGameStateForDuel(duel.matchId, roomCode, duel, endsAt, gameId, io);
  // Second broadcast 150ms later to ensure clients that missed the first get it
  setTimeout(() => broadcastGameStateForDuel(duel.matchId, roomCode, duel, endsAt, gameId, io), 150);
  // NOTE: No per-duel expiry setTimeout — the tick loop handles expiry
}

// ── Tick loop (20 TPS) ────────────────────────────────────────────────────────
// Broadcasts GAME_STATE to all active duels and handles timer expiry.
// Bomb timers remain as setTimeout for precision (50ms jitter would be noticeable).

const TICK_MS = 50;

export function startTickLoop(io: Server): ReturnType<typeof setInterval> {
  return setInterval(() => tick(io), TICK_MS);
}

function tick(io: Server): void {
  const now = Date.now();
  for (const [roomCode, arena] of arenas) {
    if (arena.phase !== "DUELING") continue;

    for (const duel of arena.duels) {
      const resolved = resolvedDuels.get(roomCode);
      if (resolved?.has(duel.matchId)) continue;

      if (arena.endsAt && now >= arena.endsAt) {
        // Timer expired — resolve the duel
        resolveDuel(roomCode, duel, io);
        continue;
      }

      // Still running — broadcast current state at 20 TPS
      broadcastGameStateForDuel(duel.matchId, roomCode, duel, arena.endsAt ?? now, arena.gameId, io);
    }
  }
}

// ── Whack a Logo bomb re-broadcast scheduling ─────────────────────────────────
// Called from GAME_INPUT handler after each whack_a_logo input.

export function scheduleBombReBroadcast(
  matchId: string, roomCode: string, duel: ArenaDuel, arenaEndsAt: number, gameId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  newState: any, io: Server,
): void {
  for (const pid of [duel.aId, duel.bId]) {
    const timerKey = `${matchId}:${pid}`;
    const slot = newState.slots?.[pid];
    if (!slot) continue;
    const msUntilExpiry = bombExpiresIn(slot);
    if (msUntilExpiry !== null) {
      const existing = bombTimers.get(timerKey);
      if (existing) clearTimeout(existing);
      bombTimers.set(timerKey, setTimeout(() => {
        bombTimers.delete(timerKey);
        const cur = gameStates.get(matchId);
        if (!cur) return;
        broadcastGameStateForDuel(matchId, roomCode, duel, arenaEndsAt, gameId, io);
      }, msUntilExpiry + 50));
    }
  }
}

// ── handleLeave re-export (used in index.ts) ──────────────────────────────────
// Re-exported here so index.ts imports from a single place, avoiding circular dep.
export { handleLeave, freshArena, scheduleRound, emitRoundUpdate } from "./roomManager";
