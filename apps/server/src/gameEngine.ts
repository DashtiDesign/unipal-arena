import { Server } from "socket.io";
import type { ArenaDuel, RoundDuel, LeaderboardEntry, MatchResultEntry, MatchScoreSummary, MatchAnswerDetails } from "@arena/shared";
import { EVENTS } from "@arena/shared";

// Accumulates per-duel results within a round so the final DUEL_RESULT broadcast
// can include all matches (needed by benched players' result screen).
// Cleared when a new round starts (in scheduleRound via resolvedDuels.set).
const roundMatchResults = new Map<string, MatchResultEntry[]>(); // roomCode → entries
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
  roundMatchResults.delete(roomCode);
  const arena = arenas.get(roomCode);
  if (arena) {
    for (const d of arena.duels) {
      clearDuelTimer(d.matchId);
      gameStates.delete(d.matchId);
    }
  }
}

// ── Score/answer extraction ────────────────────────────────────────────────────

function extractMatchMeta(
  gameDefId: string,
  stats: Record<string, unknown>,
  aId: string,
  bId: string,
): { scoreSummary?: MatchScoreSummary; answerDetails?: MatchAnswerDetails } {
  type CRResult = { correct: boolean; elapsedMs: number };

  switch (gameDefId) {
    case "tapping_speed": {
      const taps = stats.taps as Record<string, number> | undefined;
      return { scoreSummary: { aValue: taps?.[aId] ?? 0, bValue: taps?.[bId] ?? 0, label: "taps" } };
    }
    case "reaction_green": {
      type RResult = { early: boolean; elapsedMs: number | null };
      const results = stats.results as Record<string, RResult> | undefined;
      const displayMs = stats.displayMs as Record<string, number> | undefined;
      const a = results?.[aId]; const b = results?.[bId];
      // scoreSummary uses display-time if available, else server-computed elapsed
      const fmtDisplay = (id: string, r: RResult | undefined) => {
        if (r?.early) return "too early";
        const d = displayMs?.[id];
        if (d != null) return `${(d / 1000).toFixed(3)}s`;
        return r?.elapsedMs != null ? `${(r.elapsedMs / 1000).toFixed(3)}s` : "—";
      };
      return {
        scoreSummary: { aValue: fmtDisplay(aId, a), bValue: fmtDisplay(bId, b), label: "time" },
        // Carry raw displayMs so results page can show ms chip
        answerDetails: {
          aAnswer: displayMs?.[aId] ?? null,
          bAnswer: displayMs?.[bId] ?? null,
          showAnswers: false, // no "correct answer" for reaction time
        },
      };
    }
    case "stop_at_10s": {
      type SResult = { elapsedMs: number | null };
      const results = stats.results as Record<string, SResult> | undefined;
      const a = results?.[aId]; const b = results?.[bId];
      const fmt = (r: SResult | undefined) => r?.elapsedMs != null ? `${(r.elapsedMs / 1000).toFixed(3)}s` : "—";
      return { scoreSummary: { aValue: fmt(a), bValue: fmt(b), label: "stopped at" } };
    }
    case "quick_maths": {
      const results = stats.results as Record<string, CRResult> | undefined;
      const answer = stats.answer as number | undefined;
      const choices = stats.choices as Record<string, number> | undefined;
      const aRes = results?.[aId]; const bRes = results?.[bId];
      const fmt = (r: CRResult | undefined) => r ? (r.correct ? `✓ ${(r.elapsedMs / 1000).toFixed(2)}s` : "✗") : "—";
      return {
        scoreSummary: { aValue: fmt(aRes), bValue: fmt(bRes), label: "answer" },
        answerDetails: {
          correctAnswer: answer,
          aAnswer: choices?.[aId] ?? null,
          bAnswer: choices?.[bId] ?? null,
          showAnswers: true,
        },
      };
    }
    case "emoji_odd_one_out": {
      const results = stats.results as Record<string, CRResult> | undefined;
      const aRes = results?.[aId]; const bRes = results?.[bId];
      const fmt = (r: CRResult | undefined) => r ? (r.correct ? `✓ ${(r.elapsedMs / 1000).toFixed(2)}s` : "✗") : "—";
      const oddEmoji = stats.oddEmoji as string | undefined;
      return {
        scoreSummary: { aValue: fmt(aRes), bValue: fmt(bRes), label: "answer" },
        answerDetails: { correctAnswer: oddEmoji, showAnswers: false },
      };
    }
    case "memory_grid": {
      const results = stats.results as Record<string, CRResult> | undefined;
      const aRes = results?.[aId]; const bRes = results?.[bId];
      const fmt = (r: CRResult | undefined) => r ? (r.correct ? `✓ ${(r.elapsedMs / 1000).toFixed(2)}s` : "✗") : "—";
      // showAnswers = false — never reveal the grid answer breakdown
      return {
        scoreSummary: { aValue: fmt(aRes), bValue: fmt(bRes), label: "memory" },
        answerDetails: { showAnswers: false },
      };
    }
    case "higher_lower": {
      const secret = stats.secret as number | undefined;
      const aHistory = (stats[aId] as string | undefined) ?? "";
      const bHistory = (stats[bId] as string | undefined) ?? "";
      // Extract last guess from history string "42(lower),55(higher),60(correct)"
      const lastGuess = (h: string) => {
        const parts = h.split(",");
        const last = parts[parts.length - 1];
        const m = last?.match(/^(\d+)\(/);
        return m ? Number(m[1]) : null;
      };
      return {
        scoreSummary: { aValue: aHistory || "—", bValue: bHistory || "—", label: "guesses" },
        answerDetails: { correctAnswer: secret, aAnswer: lastGuess(aHistory), bAnswer: lastGuess(bHistory), showAnswers: true },
      };
    }
    case "whack_a_logo": {
      const hits = stats.hits as Record<string, number> | undefined;
      return { scoreSummary: { aValue: hits?.[aId] ?? 0, bValue: hits?.[bId] ?? 0, label: "hits" } };
    }
    case "rock_paper_scissors": {
      const fc = stats.finalChoices as Record<string, string> | null | undefined;
      return { scoreSummary: { aValue: fc?.[aId] ?? "—", bValue: fc?.[bId] ?? "—", label: "choice" } };
    }
    case "tic_tac_toe":
      return {};
    default:
      return {};
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

  // Accumulate match result for end-of-round summary
  const aPlayer = room.players.find((p) => p.id === duel.aId);
  const bPlayer = room.players.find((p) => p.id === duel.bId);
  const topOutcomeForDuel = Math.max(...Object.values(result.outcomeByPlayerId) as number[]);
  const duelWinners = Object.entries(result.outcomeByPlayerId).filter(([, v]) => v === topOutcomeForDuel);
  const duelIsDraw = duelWinners.length > 1;
  const duelWinnerId = duelIsDraw ? null : duelWinners[0][0];
  const duelWinnerName = duelWinnerId ? (room.players.find((p) => p.id === duelWinnerId)?.name ?? null) : null;

  const matchMeta = extractMatchMeta(duel.gameDefId, result.stats as Record<string, unknown>, duel.aId, duel.bId);
  const matchEntry: MatchResultEntry = {
    aId: duel.aId,
    aName: aPlayer?.name ?? duel.aId.slice(0, 6),
    bId: duel.bId,
    bName: bPlayer?.name ?? duel.bId.slice(0, 6),
    winnerId: duelWinnerId,
    winnerName: duelWinnerName,
    isDraw: duelIsDraw,
    gameDefId: duel.gameDefId,
    stats: result.stats as Record<string, unknown>,
    scoreSummary: matchMeta.scoreSummary,
    answerDetails: matchMeta.answerDetails,
  };
  if (!roundMatchResults.has(roomCode)) roundMatchResults.set(roomCode, []);
  roundMatchResults.get(roomCode)!.push(matchEntry);

  // Check if ALL duels in this round are resolved
  if (!arena.duels.every((d) => resolved!.has(d.matchId))) return;

  // All duels done — transition to RESULT
  resolvedDuels.delete(roomCode);
  const allMatches = roundMatchResults.get(roomCode) ?? [];
  roundMatchResults.delete(roomCode);

  const lb: LeaderboardEntry[] = leaderboard(room);
  // For the headline, use the last resolved duel's result
  const topOutcome = Math.max(...Object.values(result.outcomeByPlayerId) as number[]);
  const arenaWinners = Object.entries(result.outcomeByPlayerId).filter(([, v]) => v === topOutcome);
  const isDraw = arenaWinners.length > 1;
  const winnerId = isDraw ? null : arenaWinners[0][0];

  // Aggregate delta scores across all duels this round
  const roundDeltaScores: Record<string, number> = {};
  for (const entry of allMatches) {
    for (const pid of [entry.aId, entry.bId]) {
      if (!(pid in roundDeltaScores)) roundDeltaScores[pid] = 0;
    }
  }
  // Re-compute from per-duel outcomes (deltaScores only covers last duel — use per-duel data)
  for (const entry of allMatches) {
    const aOutcome = entry.winnerId === entry.aId ? 1 : entry.isDraw ? 0.5 : 0;
    const bOutcome = entry.winnerId === entry.bId ? 1 : entry.isDraw ? 0.5 : 0;
    roundDeltaScores[entry.aId] = (roundDeltaScores[entry.aId] ?? 0) + aOutcome;
    roundDeltaScores[entry.bId] = (roundDeltaScores[entry.bId] ?? 0) + bOutcome;
  }

  arena.phase = "RESULT";
  arena.lastResult = {
    winnerId,
    isDraw,
    deltaScores: roundDeltaScores,
    leaderboard: lb,
    matches: allMatches,
    benchedId: arena.benchedId,
  };
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
  io.to(roomCode).emit(EVENTS.DUEL_RESULT, {
    winnerId,
    isDraw,
    deltaScores: roundDeltaScores,
    leaderboard: lb,
    matches: allMatches,
    benchedId: arena.benchedId,
  });
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
