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
  startedAt: number;                  // epoch ms when game was initialised
  cells: string[];   // 16 items: 15 same + 1 odd
  oddIdx: number;    // which index holds the odd emoji
  answers: Record<string, number>;    // playerId -> tapped idx
  finishedAt: Record<string, number>; // playerId -> elapsed ms from startedAt
}

interface Public {
  cells: string[];
  answered: Record<string, boolean>;
  // Revealed once both answered; null while waiting
  results: Record<string, { correct: boolean; elapsedMs: number }> | null;
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
    en: "Find the one that's different! Both players tap — fastest correct answer wins.",
    ar: "ابحث عن المختلف! كلا اللاعبين ينقران — أسرع إجابة صحيحة تفوز.",
  },
  init(playerIds) {
    const [majority, odd] = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    const raw = Array(15).fill(majority) as string[];
    raw.push(odd);
    const cells = shuffle(raw);
    const oddIdx = cells.indexOf(odd);
    return { playerIds, startedAt: Date.now(), cells, oddIdx, answers: {}, finishedAt: {} };
  },
  publicState(s) {
    const allAnswered = s.playerIds.every((id) => id in s.answers);
    return {
      cells: s.cells,
      answered: Object.fromEntries(s.playerIds.map((id) => [id, id in s.answers])),
      results: allAnswered
        ? Object.fromEntries(s.playerIds.map((id) => [id, {
            correct: s.answers[id] === s.oddIdx,
            elapsedMs: s.finishedAt[id] ?? 0,
          }]))
        : null,
    };
  },
  input(s, playerId, payload) {
    if (playerId in s.answers) return s; // already answered
    const idx = (payload as { idx: number }).idx;
    return {
      ...s,
      answers: { ...s.answers, [playerId]: idx },
      finishedAt: { ...s.finishedAt, [playerId]: Date.now() - s.startedAt },
    };
  },
  isResolved(s) {
    return s.playerIds.every((id) => id in s.answers);
  },
  resolve(s) {
    const outcomeByPlayerId: Record<string, number> = {};
    const results: Record<string, { correct: boolean; elapsedMs: number }> = {};

    for (const id of s.playerIds) {
      const answered = id in s.answers;
      const correct = answered && s.answers[id] === s.oddIdx;
      const elapsedMs = s.finishedAt[id] ?? Infinity;
      results[id] = { correct, elapsedMs };
    }

    const correctPlayers = s.playerIds.filter((id) => results[id].correct);

    if (correctPlayers.length === 0) {
      for (const id of s.playerIds) outcomeByPlayerId[id] = 0.5;
    } else if (correctPlayers.length === 2) {
      const [a, b] = s.playerIds;
      const diff = Math.abs(results[a].elapsedMs - results[b].elapsedMs);
      if (diff <= 50) {
        outcomeByPlayerId[a] = 0.5;
        outcomeByPlayerId[b] = 0.5;
      } else {
        const faster = results[a].elapsedMs < results[b].elapsedMs ? a : b;
        for (const id of s.playerIds) outcomeByPlayerId[id] = id === faster ? 1 : 0;
      }
    } else {
      for (const id of s.playerIds) {
        outcomeByPlayerId[id] = results[id].correct ? 1 : 0;
      }
    }

    return {
      outcomeByPlayerId,
      stats: { oddIdx: s.oddIdx, oddEmoji: s.cells[s.oddIdx], results },
    };
  },
};

export default emojiOddOneOut;
