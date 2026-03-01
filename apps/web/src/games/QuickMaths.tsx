import { GameComponentProps } from "./types";

interface State {
  question: string;
  options: number[];
  choices: Record<string, boolean>; // playerId -> has answered
  firstCorrect: string | null;
}

export default function QuickMaths({ publicState, playerId, onInput, remainingMs }: GameComponentProps) {
  const s = publicState as State;
  const IAnswered = s.choices[playerId] ?? false;

  if (s.firstCorrect) {
    const iWon = s.firstCorrect === playerId;
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-5xl">{iWon ? "🎉" : "😢"}</p>
        <p className="text-2xl font-bold">{iWon ? "Correct! You win!" : "Too slow!"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-6 w-full">
      <div className="flex items-center justify-between w-full px-2">
        <p className="text-4xl font-mono font-bold">{s.question} = ?</p>
        <p className="badge badge-neutral tabular-nums">{Math.ceil(remainingMs / 1000)}s</p>
      </div>

      {IAnswered ? (
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
