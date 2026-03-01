import { GameComponentProps } from "./types";

interface State {
  cells: string[];
  answered: Record<string, boolean>;
  firstCorrect: string | null;
}

export default function EmojiOddOneOut({ publicState, playerId, opponentId, onInput, remainingMs }: GameComponentProps) {
  const s = publicState as State;
  const IAnswered = s.answered[playerId] ?? false;

  // Show result overlay once someone found it
  if (s.firstCorrect) {
    const iWon = s.firstCorrect === playerId;
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-5xl">{iWon ? "🎉" : "😢"}</p>
        <p className="text-2xl font-bold">{iWon ? "You found it!" : "Too slow!"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4 w-full select-none">
      <div className="flex items-center justify-between w-full px-2">
        <p className="text-sm font-semibold text-base-content/70">Which one is different?</p>
        <p className="badge badge-neutral tabular-nums">{Math.ceil(remainingMs / 1000)}s</p>
      </div>

      {IAnswered ? (
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
      {(s.answered[opponentId] ?? false) && !IAnswered && (
        <p className="text-xs text-base-content/40">Opponent answered…</p>
      )}
    </div>
  );
}
