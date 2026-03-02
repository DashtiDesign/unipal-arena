import { GameDefinition } from "@arena/shared";

const TARGET_MS = 10000;
const DRAW_THRESHOLD_MS = 50; // within 50ms = draw

interface State {
  playerIds: string[];
  startAt: number;             // epoch ms when game started
  stops: Record<string, number>; // playerId -> epoch ms when they stopped
}
interface Public {
  startAt: number;              // epoch ms — client uses this to sync timer
  stopped: Record<string, boolean>;
  stopTimes: Record<string, number | null>; // revealed after both stop or time up
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
        ? Object.fromEntries(s.playerIds.map((id) => [id, id in s.stops ? s.stops[id] - s.startAt : null]))
        : Object.fromEntries(s.playerIds.map((id) => [id, null])),
    };
  },
  input(s, playerId) {
    if (playerId in s.stops) return s;
    return { ...s, stops: { ...s.stops, [playerId]: Date.now() } };
  },
  resolve(s) {
    const diffs = s.playerIds.map((id) => ({
      id,
      elapsed: id in s.stops ? s.stops[id] - s.startAt : null,
      diff: id in s.stops ? Math.abs(s.stops[id] - s.startAt - TARGET_MS) : Infinity,
    }));
    const minDiff = Math.min(...diffs.map((d) => d.diff));
    const outcomeByPlayerId: Record<string, number> = {};

    if (Math.abs(diffs[0].diff - diffs[1].diff) <= DRAW_THRESHOLD_MS) {
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
