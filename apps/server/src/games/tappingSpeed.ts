import { GameDefinition } from "@arena/shared";

const DEBUG = process.env.DEBUG_LOGS === "1";

// Minimum milliseconds between accepted taps per player — prevents multi-touch counting as multiple taps
const TAP_DEBOUNCE_MS = 40;

interface State {
  playerIds: string[];
  taps: Record<string, number>;
  lastTapAt: Record<string, number>; // playerId → server epoch ms of last accepted tap
  done: boolean; // set to true after time expires (resolved server-side)
}

interface Public {
  myTaps: number;         // client fills this from playerId — server sends full map, client reads own key
  taps: Record<string, number>;
  done: boolean;
}

const tappingSpeed: GameDefinition<State, Public> = {
  id: "tapping_speed",
  displayName: { en: "Tapping Speed", ar: "سرعة النقر" },
  durationMs: 10000,
  instructions: {
    en: "Tap as fast as you can for 10 seconds! Most taps wins.",
    ar: "انقر بأسرع ما يمكنك لمدة 10 ثوانٍ! الأكثر نقراً يفوز.",
  },
  init(playerIds) {
    return {
      playerIds,
      taps: Object.fromEntries(playerIds.map((id) => [id, 0])),
      lastTapAt: {},
      done: false,
    };
  },
  publicState(s) {
    // Both counts shown live — keeps competition visible
    return { myTaps: 0, taps: s.taps, done: s.done };
  },
  input(s, playerId) {
    if (s.done) return s;
    const now = Date.now();
    const last = s.lastTapAt[playerId] ?? 0;
    if (now - last < TAP_DEBOUNCE_MS) {
      if (DEBUG) console.log(`[tapping_speed] debounced tap playerId=${playerId} gap=${now - last}ms`);
      return s; // reject tap — too soon (multi-touch or rapid double-fire)
    }
    const next = (s.taps[playerId] ?? 0) + 1;
    if (DEBUG) console.log(`[tapping_speed] tap playerId=${playerId} count=${next}`);
    return { ...s, taps: { ...s.taps, [playerId]: next }, lastTapAt: { ...s.lastTapAt, [playerId]: now } };
  },
  resolve(s) {
    const [a, b] = s.playerIds;
    const tA = s.taps[a] ?? 0;
    const tB = s.taps[b] ?? 0;
    const outcomeByPlayerId: Record<string, number> = {};
    if (tA === tB) {
      outcomeByPlayerId[a] = 0.5;
      outcomeByPlayerId[b] = 0.5;
    } else if (tA > tB) {
      outcomeByPlayerId[a] = 1;
      outcomeByPlayerId[b] = 0;
    } else {
      outcomeByPlayerId[a] = 0;
      outcomeByPlayerId[b] = 1;
    }
    return { outcomeByPlayerId, stats: { taps: s.taps } };
  },
};

export default tappingSpeed;
