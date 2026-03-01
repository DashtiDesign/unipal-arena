import { GameDefinition } from "@arena/shared";

type Op = "+" | "-" | "×";

interface State {
  playerIds: string[];
  question: string;
  answer: number;
  options: number[];          // 6 shuffled choices (includes correct answer)
  choices: Record<string, number>; // playerId -> chosen option value
  firstCorrect: string | null;
}

interface Public {
  question: string;
  options: number[];
  choices: Record<string, boolean>; // playerId -> has answered (not what they chose)
  firstCorrect: string | null;
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
    // Offsets close to the correct answer — makes it non-trivial
    const delta = Math.floor(Math.random() * 10) + 1;
    const sign  = Math.random() < 0.5 ? 1 : -1;
    const candidate = correct + sign * delta;
    if (candidate > 0) opts.add(candidate);
  }
  // fallback: fill with sequential near-values
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
      b = Math.floor(Math.random() * (a - 1)) + 1; // ensure positive result
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
    en: "Tap the correct answer first to win! First correct answer wins.",
    ar: "انقر على الإجابة الصحيحة أولاً لتفوز! أول إجابة صحيحة تفوز.",
  },
  init(playerIds) {
    const { question, answer } = makeQuestion();
    const options = makePlausibleOptions(answer);
    return { playerIds, question, answer, options, choices: {}, firstCorrect: null };
  },
  publicState(s) {
    return {
      question: s.question,
      options: s.options,
      // Only reveal whether they answered, not what they chose
      choices: Object.fromEntries(s.playerIds.map((id) => [id, id in s.choices])),
      firstCorrect: s.firstCorrect,
    };
  },
  input(s, playerId, payload) {
    // Each player gets exactly one attempt
    if (playerId in s.choices) return s;
    const chosen = Number((payload as { answer: unknown }).answer);
    const newChoices = { ...s.choices, [playerId]: chosen };
    const correct = chosen === s.answer && !s.firstCorrect ? playerId : s.firstCorrect;
    return { ...s, choices: newChoices, firstCorrect: correct };
  },
  resolve(s) {
    const outcomeByPlayerId: Record<string, number> = {};
    for (const id of s.playerIds) {
      if (s.firstCorrect === id) {
        outcomeByPlayerId[id] = 1;
      } else if (s.firstCorrect) {
        // Someone else got it right
        outcomeByPlayerId[id] = 0;
      } else {
        // No one got it right (both wrong or no answers) => draw
        outcomeByPlayerId[id] = 0.5;
      }
    }
    return { outcomeByPlayerId, stats: { answer: s.answer, choices: s.choices, winner: s.firstCorrect } };
  },
};

export default quickMaths;
