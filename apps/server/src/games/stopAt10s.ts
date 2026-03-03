import { GameDefinition } from "@arena/shared";

const TARGET_MS = 10000;

interface State {
  playerIds: string[];
  startAt: number;               // epoch ms when game started (server-authoritative)
  stops: Record<string, number>; // playerId -> elapsed ms (server-authoritative delta)
}
interface Public {
  startAt: number;               // epoch ms — client uses this to sync its local timer
  stopped: Record<string, boolean>;
  // Revealed after both stop or time up: the exact elapsed ms used by server for judgement
  stopTimes: Record<string, number | null>;
}

const stopAt10s: GameDefinition<State, Public> = {
  id: "stop_at_10s",
  displayName: { en: "Stop at 10s", ar: "أوقف عند 10 ثوانٍ" },
  durationMs: 15000,
  instructions: {
    en: "Stop the timer as close to 10.000 seconds as possible!",
    ar: "أوقف المؤقت بأقرب وقت ممكن من 10 ثوانٍ بالضبط!",
  },
  init(playerIds) {
    return { playerIds, startAt: Date.now(), stops: {} };
  },
  publicState(s) {
    const bothStopped = s.playerIds.every((id) => id in s.stops);
    return {
      startAt: s.startAt,
      stopped: Object.fromEntries(s.playerIds.map((id) => [id, id in s.stops])),
      // Only reveal elapsed times once both have stopped (no cheating)
      stopTimes: bothStopped
        ? Object.fromEntries(s.playerIds.map((id) => [id, id in s.stops ? s.stops[id] : null]))
        : Object.fromEntries(s.playerIds.map((id) => [id, null])),
    };
  },
  input(s, playerId, payload) {
    if (playerId in s.stops) return s;

    // Server-authoritative delta:
    // eventServerTime is injected by GAME_INPUT handler after clock-offset calibration.
    // playerStopDeltaMs = eventServerTime - startAt
    // This is what gets displayed and compared — no client-side recomputation.
    const p = payload as { eventServerTime?: number; clientNowMs?: number };
    let elapsedMs: number;

    if (typeof p.eventServerTime === "number") {
      elapsedMs = Math.round(p.eventServerTime - s.startAt);
    } else {
      // Fallback: pure server time (no calibration available)
      elapsedMs = Date.now() - s.startAt;
    }

    // Sanity clamp: must be non-negative and within game duration
    elapsedMs = Math.max(0, Math.min(15000, elapsedMs));

    console.log(`[stop_at_10s] playerId=${playerId} elapsedMs=${elapsedMs} diff=${Math.abs(elapsedMs - TARGET_MS)}ms`);

    return { ...s, stops: { ...s.stops, [playerId]: elapsedMs } };
  },
  resolve(s) {
    const diffs = s.playerIds.map((id) => ({
      id,
      elapsed: id in s.stops ? s.stops[id] : null,
      diff: id in s.stops ? Math.abs(s.stops[id] - TARGET_MS) : Infinity,
    }));
    const minDiff = Math.min(...diffs.map((d) => d.diff));
    const outcomeByPlayerId: Record<string, number> = {};

    if (diffs[0].diff === diffs[1].diff) {
      for (const { id } of diffs) outcomeByPlayerId[id] = 0.5;
    } else {
      for (const d of diffs) {
        outcomeByPlayerId[d.id] = d.diff === minDiff ? 1 : 0;
      }
    }

    const results: Record<string, { elapsedMs: number | null; diffMs: number }> = {};
    for (const d of diffs) {
      results[d.id] = {
        elapsedMs: d.elapsed,
        diffMs: d.diff === Infinity ? -1 : Math.round(d.diff),
      };
    }
    return { outcomeByPlayerId, stats: { results, targetMs: TARGET_MS } };
  },
};

export default stopAt10s;
