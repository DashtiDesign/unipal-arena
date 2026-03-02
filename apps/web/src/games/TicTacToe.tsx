import { useState, useEffect } from "react";
import { GameComponentProps } from "./types";

type Cell = "X" | "O" | null;
interface State {
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
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winningLine(board: Cell[], mark: Cell): number[] | null {
  for (const line of WINS) {
    if (line.every((i) => board[i] === mark)) return line;
  }
  return null;
}

export default function TicTacToe({
  publicState, playerId, opponentId, onInput,
}: GameComponentProps) {
  const s = publicState as State;
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (s.winner || s.isDraw || s.timedOut) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [s.winner, s.isDraw, s.timedOut]);

  const myMark   = s.marks[playerId];
  const oppMark  = s.marks[opponentId];
  const isMyTurn = s.turn === playerId && !s.winner && !s.isDraw && !s.timedOut;
  const gameOver = !!(s.winner || s.isDraw || s.timedOut);

  const turnElapsed  = now - s.turnStartedAt;
  const turnLeft     = Math.max(0, s.turnMs - turnElapsed);
  const turnPct      = (turnLeft / s.turnMs) * 100;
  const timerUrgent  = turnLeft < 2000;

  const winLine = s.winner
    ? winningLine(s.board, s.marks[s.winner])
    : null;

  // Status message
  let statusMsg = "";
  let statusClass = "text-base-content/60";
  if (s.timedOut) {
    statusMsg = s.timedOut === playerId ? "You ran out of time!" : "Opponent timed out!";
    statusClass = s.timedOut === playerId ? "text-error" : "text-success";
  } else if (s.winner) {
    statusMsg = s.winner === playerId ? "You win! 🎉" : "Opponent wins!";
    statusClass = s.winner === playerId ? "text-success font-bold" : "text-error";
  } else if (s.isDraw) {
    statusMsg = "It's a draw!";
  } else if (isMyTurn) {
    statusMsg = "Your turn";
    statusClass = "text-primary font-semibold";
  } else {
    statusMsg = "Opponent's turn";
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4 w-full select-none">
      {/* Mark legend */}
      <div className="flex justify-between w-full px-4 text-sm">
        <span className="font-bold text-primary">You = {myMark}</span>
        <span className="font-bold text-secondary">Opp = {oppMark}</span>
      </div>

      {/* Turn timer bar */}
      {!gameOver && (
        <div className="w-full h-2 bg-base-300 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-none ${timerUrgent ? "bg-error animate-pulse" : isMyTurn ? "bg-primary" : "bg-secondary"}`}
            style={{ width: `${turnPct}%` }}
          />
        </div>
      )}
      {!gameOver && (
        <p className={`text-xs tabular-nums ${timerUrgent && isMyTurn ? "text-error font-bold" : "text-base-content/40"}`}>
          {isMyTurn ? `${(turnLeft / 1000).toFixed(1)}s left` : "opponent thinking…"}
        </p>
      )}

      {/* Status */}
      {!gameOver && !isMyTurn ? (
        <p className="text-xl font-bold text-center text-base-content/50">Opponent's turn…</p>
      ) : (
        <p className={`text-base text-center min-h-[1.5rem] ${statusClass}`}>{statusMsg}</p>
      )}

      {/* Board */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
        {s.board.map((cell, i) => {
          const isWinCell = winLine?.includes(i) ?? false;
          return (
            <button
              key={i}
              disabled={!!cell || !isMyTurn}
              onPointerDown={(e) => { e.preventDefault(); if (!cell && isMyTurn) onInput({ idx: i }); }}
              className={[
                "aspect-square rounded-2xl text-4xl font-bold border-2 transition-all",
                "flex items-center justify-center",
                isWinCell
                  ? "bg-success/20 border-success"
                  : cell
                  ? "bg-base-200 border-base-300 cursor-default"
                  : isMyTurn
                  ? "bg-base-100 border-base-300 hover:bg-primary/10 hover:border-primary active:scale-95"
                  : "bg-base-200 border-base-300 cursor-default",
              ].join(" ")}
              style={{ touchAction: "none" }}
            >
              <span className={
                cell === myMark ? "text-primary" : cell === oppMark ? "text-secondary" : ""
              }>
                {cell ?? ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
