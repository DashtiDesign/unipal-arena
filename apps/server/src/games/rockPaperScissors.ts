import { GameDefinition } from "@arena/shared";

type Choice = "rock" | "paper" | "scissors";

interface State {
  playerIds: string[];
  choices: Record<string, Choice>;            // current sub-round choices
  lastChoices: Record<string, Choice> | null; // choices from last completed (tie) sub-round
  subRound: number;                           // 1-based sub-round counter
  finished: boolean;
  winner: string | null;
}

interface Public {
  chosen: Record<string, boolean>;
  // Revealed when both chose current sub-round (including tie reveal before clearing) OR finished
  choices: Record<string, Choice> | null;
  lastChoices: Record<string, Choice> | null;
  subRound: number;
  finished: boolean;
  winner: string | null;
}

const beats: Record<Choice, Choice> = { rock: "scissors", scissors: "paper", paper: "rock" };
const VALID = new Set<string>(["rock", "paper", "scissors"]);

const rockPaperScissors: GameDefinition<State, Public> = {
  id: "rock_paper_scissors",
  displayName: { en: "Rock Paper Scissors", ar: "حجر ورق مقص" },
  durationMs: 30_000,
  instructions: {
    en: "Choose rock, paper, or scissors. Both choices are revealed only when both players pick. Ties replay until someone wins — or the clock runs out!",
    ar: "اختر حجر أو ورق أو مقص. تُكشف الاختيارات فقط عندما يختار كلا اللاعبين. التعادل يُعيد اللعب حتى يفوز أحدهم — أو ينتهي الوقت!",
  },

  init(playerIds) {
    return { playerIds, choices: {}, lastChoices: null, subRound: 1, finished: false, winner: null };
  },

  publicState(s): Public {
    const bothChoseThisRound = s.playerIds.every((id) => id in s.choices);
    return {
      chosen: Object.fromEntries(s.playerIds.map((id) => [id, id in s.choices])),
      // Reveal current choices when both chose (either finished or tie being shown)
      choices: (bothChoseThisRound || s.finished) && Object.keys(s.choices).length > 0
        ? s.choices
        : null,
      lastChoices: s.lastChoices,
      subRound: s.subRound,
      finished: s.finished,
      winner: s.winner,
    };
  },

  input(s, playerId, payload) {
    if (s.finished) return s;
    if (s.choices[playerId]) return s; // already chose this sub-round

    const choice = (payload as { choice: string }).choice;
    if (!VALID.has(choice)) return s;

    const newChoices = { ...s.choices, [playerId]: choice as Choice };

    // If only one player has chosen, just update state
    if (!s.playerIds.every((id) => id in newChoices)) {
      return { ...s, choices: newChoices };
    }

    // Both chose — evaluate
    const [a, b] = s.playerIds;
    const ca = newChoices[a];
    const cb = newChoices[b];

    if (ca === cb) {
      // Tie — record lastChoices for client display, clear for next sub-round
      return {
        ...s,
        choices: {},
        lastChoices: newChoices,
        subRound: s.subRound + 1,
      };
    }

    // Non-draw result
    const winner = beats[ca] === cb ? a : b;
    return { ...s, choices: newChoices, lastChoices: null, finished: true, winner };
  },

  isResolved(s) {
    return s.finished;
  },

  resolve(s) {
    const [a, b] = s.playerIds;
    const outcomeByPlayerId: Record<string, number> = {};

    if (s.winner) {
      outcomeByPlayerId[a] = a === s.winner ? 1 : 0;
      outcomeByPlayerId[b] = b === s.winner ? 1 : 0;
    } else {
      // Timer expired — check partial sub-round choices
      const ca = s.choices[a] as Choice | undefined;
      const cb = s.choices[b] as Choice | undefined;
      if (ca && !cb) {
        // Only a chose — a wins
        outcomeByPlayerId[a] = 1;
        outcomeByPlayerId[b] = 0;
      } else if (!ca && cb) {
        // Only b chose — b wins
        outcomeByPlayerId[a] = 0;
        outcomeByPlayerId[b] = 1;
      } else {
        // Neither chose, or both chose same (tie at timeout) — draw
        outcomeByPlayerId[a] = 0.5;
        outcomeByPlayerId[b] = 0.5;
      }
    }

    // final choices = winning sub-round choices (or last partial choices at timeout)
    const finalChoices = Object.keys(s.choices).length > 0 ? s.choices : null;
    return { outcomeByPlayerId, stats: { subRounds: s.subRound, finalChoices, winner: s.winner } };
  },
};

export default rockPaperScissors;
