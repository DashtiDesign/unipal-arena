import { GameDefinition } from "@arena/shared";

type Op = "+" | "-" | "×";

interface State {
  playerIds: string[];
  startedAt: number;                  // epoch ms when game was initialised
  question: string;
  answer: number;
  options: number[];          // 6 shuffled choices (includes correct answer)
  choices: Record<string, number>;    // playerId -> chosen option value
  finishedAt: Record<string, number>; // playerId -> elapsed ms from startedAt
}

interface Public {
  question: string;
  options: number[];
  choices: Record<string, boolean>; // playerId -> has answered (not what they chose)
  // Revealed once both answered; null while waiting
  results: Record<string, { correct: boolean; elapsedMs: number }> | null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makePlausibleOptions(correct: number): number[] {
  const opts = new Set<number>([correct]);
  const attempts = 50;
  for (let i = 0; i < attempts && opts.size < 6; i++) {
    const delta = Math.floor(Math.random() * 10) + 1;
    const sign  = Math.random() < 0.5 ? 1 : -1;
    const candidate = correct + sign * delta;
    if (candidate > 0) opts.add(candidate);
  }
  let fill = 1;
  while (opts.size < 6) { if (!opts.has(correct + fill)) opts.add(correct + fill); fill++; }
  return shuffle([...opts]).slice(0, 6);
}

function makeQuestion(): { question: string; answer: number } {
  const op: Op = (["+" , "-", "×"] as Op[])[Math.floor(Math.random() * 3)];
  let a: number, b: number, answer: number;
  switch (op) {
    case "+":
      a = Math.floor(Math.random() * 20) + 1;
      b = Math.floor(Math.random() * 20) + 1;
      answer = a + b;
      break;
    case "-":
      a = Math.floor(Math.random() * 20) + 5;
      b = Math.floor(Math.random() * (a - 1)) + 1;
      answer = a - b;
      break;
    case "×":
      a = Math.floor(Math.random() * 9) + 2;
      b = Math.floor(Math.random() * 9) + 2;
      answer = a * b;
      break;
  }
  return { question: `${a} ${op} ${b}`, answer };
}

const quickMaths: GameDefinition<State, Public> = {
  id: "quick_maths",
  displayName: { en: "Quick Maths", ar: "الرياضيات السريعة" },
  durationMs: 8000,
  instructions: {
    en: "Tap the correct answer! Both players answer — fastest correct answer wins.",
    ar: "انقر على الإجابة الصحيحة! كلا اللاعبين يجيبان — أسرع إجابة صحيحة تفوز.",
  },
  init(playerIds) {
    const { question, answer } = makeQuestion();
    const options = makePlausibleOptions(answer);
    return { playerIds, startedAt: Date.now(), question, answer, options, choices: {}, finishedAt: {} };
  },
  publicState(s) {
    const allAnswered = s.playerIds.every((id) => id in s.choices);
    return {
      question: s.question,
      options: s.options,
      choices: Object.fromEntries(s.playerIds.map((id) => [id, id in s.choices])),
      results: allAnswered
        ? Object.fromEntries(s.playerIds.map((id) => [id, {
            correct: s.choices[id] === s.answer,
            elapsedMs: s.finishedAt[id] ?? 0,
          }]))
        : null,
    };
  },
  input(s, playerId, payload) {
    if (playerId in s.choices) return s;
    const chosen = Number((payload as { answer: unknown }).answer);
    return {
      ...s,
      choices: { ...s.choices, [playerId]: chosen },
      finishedAt: { ...s.finishedAt, [playerId]: Date.now() - s.startedAt },
    };
  },
  isResolved(s) {
    return s.playerIds.every((id) => id in s.choices);
  },
  resolve(s) {
    const outcomeByPlayerId: Record<string, number> = {};
    const results: Record<string, { correct: boolean; elapsedMs: number }> = {};

    for (const id of s.playerIds) {
      const correct = (id in s.choices) && s.choices[id] === s.answer;
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

    return { outcomeByPlayerId, stats: { answer: s.answer, results, choices: s.choices } };
  },
};

export default quickMaths;
