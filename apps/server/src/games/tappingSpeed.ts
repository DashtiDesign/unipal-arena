import { GameDefinition } from "@arena/shared";

interface State {
  playerIds: string[];
  taps: Record<string, number>;
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
      done: false,
    };
  },
  publicState(s) {
    // Both counts shown live — keeps competition visible
    return { myTaps: 0, taps: s.taps, done: s.done };
  },
  input(s, playerId) {
    if (s.done) return s;
    return { ...s, taps: { ...s.taps, [playerId]: (s.taps[playerId] ?? 0) + 1 } };
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
