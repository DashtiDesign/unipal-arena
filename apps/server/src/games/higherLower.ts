import { GameDefinition } from "@arena/shared";

// 90 seconds — unlimited rounds, bounded by time
const TOTAL_MS = 90_000;

type Hint = "higher" | "lower" | "correct";

interface RoundGuess {
  guess: number;
  hint: Hint;
}

interface State {
  playerIds: string[];
  secret: number;
  round: number; // current round number (1-based)
  // current round submissions: filled when a player submits this round
  roundGuesses: Record<string, RoundGuess>;
  // full history across all completed rounds
  history: Record<string, RoundGuess[]>;
  winner: string | null;
  isDraw: boolean;
  finished: boolean;
}

interface Public {
  round: number;
  submitted: Record<string, boolean>; // has each player submitted this round?
  winner: string | null;
  isDraw: boolean;
  finished: boolean;
}

const higherLower: GameDefinition<State, Public> = {
  id: "higher_lower",
  displayName: { en: "Higher or Lower", ar: "أعلى أم أقل" },
  durationMs: TOTAL_MS,
  instructions: {
    en: "Guess the secret number (1–100). Submit a guess each round — you'll get a private hint immediately. Both players must submit before the next round begins. First to guess correctly wins!",
    ar: "خمّن الرقم السري (1–100). قدّم تخمينك كل جولة — ستحصل على تلميح سري فوراً. يجب أن يقدّم كلا اللاعبين قبل بدء الجولة التالية. أول من يصيب يفوز!",
  },

  init(playerIds) {
    return {
      playerIds,
      secret: Math.floor(Math.random() * 100) + 1,
      round: 1,
      roundGuesses: {},
      history: Object.fromEntries(playerIds.map((id) => [id, []])),
      winner: null,
      isDraw: false,
      finished: false,
    };
  },

  publicState(s): Public {
    // If all guesses are from the previous round (stale), treat current round as unsubmitted
    const stale = s.playerIds.every((id) => id in s.roundGuesses);
    const submitted = stale
      ? Object.fromEntries(s.playerIds.map((id) => [id, false]))
      : Object.fromEntries(s.playerIds.map((id) => [id, id in s.roundGuesses]));
    return {
      round: s.round,
      submitted,
      winner: s.winner,
      isDraw: s.isDraw,
      finished: s.finished,
    };
  },

  input(s, playerId, payload) {
    if (s.finished) return s;

    // If both players' guesses from the previous round are still present (round advanced
    // but roundGuesses wasn't cleared yet), clear them now for the new round.
    const stale = s.playerIds.every((id) => id in s.roundGuesses);
    const currentGuesses = stale ? {} : s.roundGuesses;

    if (currentGuesses[playerId]) return s; // already submitted this round

    const guess = Number((payload as { guess: unknown }).guess);
    if (!Number.isInteger(guess) || guess < 1 || guess > 100) return s;

    const hint: Hint =
      guess === s.secret ? "correct" : guess < s.secret ? "higher" : "lower";

    const newRoundGuesses = { ...currentGuesses, [playerId]: { guess, hint } };

    // Check if both players have submitted this round
    const bothSubmitted = s.playerIds.every((id) => id in newRoundGuesses);

    if (!bothSubmitted) {
      return { ...s, roundGuesses: newRoundGuesses };
    }

    // Both submitted — append to history and evaluate
    const newHistory: Record<string, RoundGuess[]> = {};
    for (const id of s.playerIds) {
      newHistory[id] = [...(s.history[id] ?? []), newRoundGuesses[id]];
    }

    const [a, b] = s.playerIds;
    const aCorrect = newRoundGuesses[a].hint === "correct";
    const bCorrect = newRoundGuesses[b].hint === "correct";

    if (aCorrect && bCorrect) {
      // Both correct same round → draw
      return { ...s, roundGuesses: newRoundGuesses, history: newHistory, isDraw: true, finished: true };
    }
    if (aCorrect) {
      return { ...s, roundGuesses: newRoundGuesses, history: newHistory, winner: a, finished: true };
    }
    if (bCorrect) {
      return { ...s, roundGuesses: newRoundGuesses, history: newHistory, winner: b, finished: true };
    }

    // Neither correct — advance to next round.
    // Keep roundGuesses from this round so privateUpdate can emit hints to both players.
    // The next input() call detects the round mismatch and clears stale guesses.
    return {
      ...s,
      history: newHistory,
      roundGuesses: newRoundGuesses,
      round: s.round + 1,
    };
  },

  privateUpdate(s, playerId) {
    const rg = s.roundGuesses[playerId];
    if (!rg) return null;
    // When round has advanced (both submitted, neither correct), roundGuesses still hold
    // last round's data but s.round is already incremented — report the previous round number.
    const guessRound = s.playerIds.every((id) => id in s.roundGuesses)
      ? s.round - 1  // both submitted → round already advanced
      : s.round;
    return { round: guessRound, hint: rg.hint, guess: rg.guess };
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
      // draw or timer expired with no correct guess
      outcomeByPlayerId[a] = 0.5;
      outcomeByPlayerId[b] = 0.5;
    }

    const stats: Record<string, unknown> = { secret: s.secret, rounds: s.round };
    for (const id of s.playerIds) {
      stats[id] = (s.history[id] ?? []).map((h) => `${h.guess}(${h.hint})`).join(", ") || "no guesses";
    }
    return { outcomeByPlayerId, stats };
  },
};

export default higherLower;
