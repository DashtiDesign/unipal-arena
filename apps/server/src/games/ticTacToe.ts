import { GameDefinition } from "@arena/shared";

type Cell = "X" | "O" | null;

const TURN_MS = 15000;
const MAX_TURNS = 9;

interface State {
  playerIds: string[];
  board: Cell[];
  marks: Record<string, "X" | "O">;
  turn: string;        // playerId whose turn it is
  turnStartedAt: number; // epoch ms when current turn began
  winner: string | null; // playerId or null
  isDraw: boolean;
  timedOut: string | null; // playerId who timed out
}

interface Public {
  board: Cell[];
  marks: Record<string, "X" | "O">;
  turn: string;
  turnStartedAt: number;
  turnMs: number;
  winner: string | null;
  isDraw: boolean;
  timedOut: string | null;
}

const WINS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diags
];

function checkWinner(board: Cell[], mark: "X" | "O"): boolean {
  return WINS.some((line) => line.every((i) => board[i] === mark));
}

const ticTacToe: GameDefinition<State, Public> = {
  id: "tic_tac_toe",
  displayName: { en: "Tic-Tac-Toe", ar: "إكس-أو" },
  durationMs: MAX_TURNS * TURN_MS, // 135s — enough for a full game
  instructions: {
    en: "Tic-Tac-Toe! Three in a row wins. You have 15s per turn — don't run out!",
    ar: "إكس-أو! ثلاثة في صف يفوز. لديك 15 ثانية لكل دور — لا تتأخر!",
  },
  init(playerIds) {
    const marks: Record<string, "X" | "O"> = {
      [playerIds[0]]: "X",
      [playerIds[1]]: "O",
    };
    return {
      playerIds,
      board: new Array(9).fill(null) as Cell[],
      marks,
      turn: playerIds[0],
      turnStartedAt: Date.now(),
      winner: null,
      isDraw: false,
      timedOut: null,
    };
  },

  publicState(s) {
    return {
      board: s.board,
      marks: s.marks,
      turn: s.turn,
      turnStartedAt: s.turnStartedAt,
      turnMs: TURN_MS,
      winner: s.winner,
      isDraw: s.isDraw,
      timedOut: s.timedOut,
    };
  },

  input(s, playerId, payload) {
    if (s.winner || s.isDraw || s.timedOut) return s;
    if (s.turn !== playerId) return s;

    // Turn timeout — this player ran out of time
    if (Date.now() > s.turnStartedAt + TURN_MS) {
      const opponent = s.playerIds.find((id) => id !== playerId)!;
      return { ...s, timedOut: playerId, winner: opponent };
    }

    const idx = (payload as { idx: number }).idx;
    if (!Number.isInteger(idx) || idx < 0 || idx > 8) return s;
    if (s.board[idx] != null) return s;

    const board = [...s.board] as Cell[];
    board[idx] = s.marks[playerId];
    const won = checkWinner(board, s.marks[playerId]);
    const full = board.every((c) => c !== null);
    const next = s.playerIds.find((id) => id !== playerId)!;

    return {
      ...s,
      board,
      turn: next,
      turnStartedAt: Date.now(),
      winner: won ? playerId : null,
      isDraw: !won && full,
    };
  },

  isResolved(s) {
    return !!(s.winner || s.isDraw || s.timedOut);
  },

  resolve(s) {
    // If game ended normally via input, use stored result.
    // If total-time expired mid-game, treat the player whose turn it is as having timed out.
    let { winner, isDraw, timedOut } = s;
    if (!winner && !isDraw && !timedOut) {
      const opponent = s.playerIds.find((id) => id !== s.turn)!;
      winner = opponent;
      timedOut = s.turn;
    }

    const outcomeByPlayerId: Record<string, number> = {};
    for (const id of s.playerIds) {
      outcomeByPlayerId[id] = winner === id ? 1 : winner ? 0 : 0.5;
    }
    return {
      outcomeByPlayerId,
      stats: { board: s.board, winner, isDraw, timedOut },
    };
  },
};

export default ticTacToe;
