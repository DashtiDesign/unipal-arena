import { GameComponentProps } from "./types";

interface PlayerResult {
  correct: boolean;
  elapsedMs: number;
}

interface State {
  question: string;
  options: number[];
  choices: Record<string, boolean>; // playerId -> has answered
  results: Record<string, PlayerResult> | null;
}

export default function QuickMaths({ publicState, playerId, opponentId, onInput, remainingMs }: GameComponentProps) {
  const s = publicState as State;
  const iAnswered = s.choices[playerId] ?? false;

  // Both answered — show results
  if (s.results) {
    const mine = s.results[playerId];
    const theirs = s.results[opponentId];
    const iWon = mine?.correct && (!theirs?.correct || mine.elapsedMs < theirs.elapsedMs);
    const isDraw = mine?.correct && theirs?.correct && Math.abs(mine.elapsedMs - theirs.elapsedMs) <= 50;

    return (
      <div className="flex flex-col items-center gap-4 py-6 w-full">
        <p className="text-4xl">{isDraw ? "🤝" : iWon ? "🎉" : "😢"}</p>
        <p className="text-xl font-bold">
          {isDraw ? "Draw!" : iWon ? "You win!" : "You lose!"}
        </p>
        <div className="w-full flex flex-col gap-2 max-w-xs">
          {[
            { label: "You", result: mine },
            { label: "Opponent", result: theirs },
          ].map(({ label, result }) => (
            <div key={label} className="flex items-center justify-between p-3 bg-base-200 rounded-xl">
              <span className="text-sm font-semibold">{label}</span>
              <div className="text-right">
                <p className={`font-bold text-sm ${result?.correct ? "text-success" : "text-error"}`}>
                  {result?.correct ? "✓ Correct" : "✗ Wrong"}
                </p>
                <p className="text-xs text-base-content/50 tabular-nums">
                  {result ? `${(result.elapsedMs / 1000).toFixed(2)}s` : "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-6 w-full">
      <div className="flex items-center justify-between w-full px-2">
        <p className="text-4xl font-mono font-bold">{s.question} = ?</p>
        <p className="badge badge-neutral tabular-nums">{Math.ceil(remainingMs / 1000)}s</p>
      </div>

      {iAnswered ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <span className="loading loading-dots loading-lg" />
          <p className="text-base-content/60 text-sm">Waiting for opponent…</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 w-full">
          {s.options.map((opt) => (
            <button
              key={opt}
              className="btn btn-outline btn-lg text-2xl font-mono h-16 min-h-[64px]"
              onClick={() => onInput({ answer: opt })}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
