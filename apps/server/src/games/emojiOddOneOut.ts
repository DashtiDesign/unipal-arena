import { GameDefinition } from "@arena/shared";

// Pairs of [majority emoji, minority (odd) emoji]
const PAIRS: [string, string][] = [
  ["🍎", "🍊"], ["🐶", "🐱"], ["🌟", "☀️"], ["🎯", "🎲"],
  ["🚗", "🚕"], ["🏠", "🏰"], ["🌈", "⛅"], ["🎵", "🎺"],
  ["🌸", "🌻"], ["🦁", "🐯"], ["🍕", "🌮"], ["⚽", "🏈"],
  ["🎃", "👻"], ["🦋", "🐝"], ["🍦", "🍩"], ["🌊", "🏔️"],
  ["🎸", "🎹"], ["🦊", "🐺"], ["🍇", "🍓"], ["🚀", "✈️"],
];

interface State {
  playerIds: string[];
  cells: string[];   // 16 items: 15 same + 1 odd
  oddIdx: number;    // which index holds the odd emoji
  answers: Record<string, number>; // playerId -> tapped idx (-1 = no tap yet key absent)
  firstCorrect: string | null;
}
interface Public {
  cells: string[];
  answered: Record<string, boolean>;
  firstCorrect: string | null;
}

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const emojiOddOneOut: GameDefinition<State, Public> = {
  id: "emoji_odd_one_out",
  displayName: { en: "Odd One Out", ar: "المختلف" },
  durationMs: 8000,
  instructions: {
    en: "Find the one that's different! Tap it faster than your opponent.",
    ar: "ابحث عن المختلف! انقر عليه أسرع من خصمك.",
  },
  init(playerIds) {
    const [majority, odd] = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    // Build 16-cell array with 15 majority + 1 odd, then shuffle
    const raw = Array(15).fill(majority) as string[];
    raw.push(odd);
    const cells = shuffle(raw);
    const oddIdx = cells.indexOf(odd);
    return { playerIds, cells, oddIdx, answers: {}, firstCorrect: null };
  },
  publicState(s) {
    return {
      cells: s.cells,
      answered: Object.fromEntries(s.playerIds.map((id) => [id, id in s.answers])),
      firstCorrect: s.firstCorrect,
    };
  },
  input(s, playerId, payload) {
    if (playerId in s.answers || s.firstCorrect) return s;
    const idx = (payload as { idx: number }).idx;
    const newAnswers = { ...s.answers, [playerId]: idx };
    const correct = idx === s.oddIdx;
    return {
      ...s,
      answers: newAnswers,
      firstCorrect: correct ? playerId : s.firstCorrect,
    };
  },
  resolve(s) {
    const outcomeByPlayerId: Record<string, number> = {};
    if (s.firstCorrect) {
      for (const id of s.playerIds) {
        outcomeByPlayerId[id] = id === s.firstCorrect ? 1 : 0;
      }
    } else {
      // No one got it right (time expired or both wrong) → draw
      for (const id of s.playerIds) outcomeByPlayerId[id] = 0.5;
    }
    return {
      outcomeByPlayerId,
      stats: { oddIdx: s.oddIdx, oddEmoji: s.cells[s.oddIdx], answers: s.answers },
    };
  },
};

export default emojiOddOneOut;
