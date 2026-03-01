import { GameComponentProps } from "./types";

interface PlayerResult {
  correct: boolean;
  elapsedMs: number;
}

interface State {
  cells: string[];
  answered: Record<string, boolean>;
  results: Record<string, PlayerResult> | null;
}

export default function EmojiOddOneOut({ publicState, playerId, opponentId, onInput, remainingMs }: GameComponentProps) {
  const s = publicState as State;
  const iAnswered = s.answered[playerId] ?? false;

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
          {isDraw ? "Draw!" : iWon ? "You found it!" : "Too slow!"}
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
    <div className="flex flex-col items-center gap-4 py-4 w-full select-none">
      <div className="flex items-center justify-between w-full px-2">
        <p className="text-sm font-semibold text-base-content/70">Which one is different?</p>
        <p className="badge badge-neutral tabular-nums">{Math.ceil(remainingMs / 1000)}s</p>
      </div>

      {iAnswered ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <span className="loading loading-dots loading-lg" />
          <p className="text-sm text-base-content/50">Waiting for opponent…</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 w-full">
          {s.cells.map((emoji, i) => (
            <button
              key={i}
              className="aspect-square rounded-xl bg-base-200 flex items-center justify-center text-3xl active:scale-90 transition-transform hover:bg-base-300"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => { e.preventDefault(); onInput({ idx: i }); }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Subtle opponent status */}
      {(s.answered[opponentId] ?? false) && !iAnswered && (
        <p className="text-xs text-base-content/40">Opponent answered…</p>
      )}
    </div>
  );
}
