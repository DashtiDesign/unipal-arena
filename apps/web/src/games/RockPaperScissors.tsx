import { GameComponentProps } from "./types";

type Choice = "rock" | "paper" | "scissors";

interface PublicState {
  chosen: Record<string, boolean>;
  choices: Record<string, Choice> | null;
  lastChoices: Record<string, Choice> | null;
  subRound: number;
  finished: boolean;
  winner: string | null;
}

const OPTIONS: { v: Choice; label: string; e: string }[] = [
  { v: "rock",     label: "Rock",     e: "🪨" },
  { v: "paper",    label: "Paper",    e: "📄" },
  { v: "scissors", label: "Scissors", e: "✂️" },
];

const beats: Record<Choice, Choice> = { rock: "scissors", scissors: "paper", paper: "rock" };

function emoji(c: Choice | undefined) {
  if (!c) return "❓";
  return OPTIONS.find((o) => o.v === c)?.e ?? "?";
}

export default function RockPaperScissors({
  publicState, playerId, opponentId, onInput, remainingMs,
}: GameComponentProps) {
  const s = publicState as PublicState;
  const iChose = s.chosen[playerId] ?? false;
  const oppChose = s.chosen[opponentId] ?? false;

  const myChoice = s.choices?.[playerId];
  const oppChoice = s.choices?.[opponentId];

  // ── Finished: final result ─────────────────────────────────────────────────
  if (s.finished && s.choices) {
    const mine = s.choices[playerId] as Choice | undefined;
    const theirs = s.choices[opponentId] as Choice | undefined;

    let resultLabel = "";
    let resultClass = "";
    if (!mine) {
      resultLabel = "You didn't pick — you lose!";
      resultClass = "text-error";
    } else if (!theirs) {
      resultLabel = "Opponent didn't pick — you win!";
      resultClass = "text-success";
    } else if (beats[mine] === theirs) {
      resultLabel = "You win!";
      resultClass = "text-success";
    } else {
      resultLabel = "You lose!";
      resultClass = "text-error";
    }

    return (
      <div className="flex flex-col items-center gap-6 py-8 w-full">
        {s.subRound > 1 && (
          <p className="text-xs text-base-content/40 uppercase tracking-widest">
            After {s.subRound} sub-rounds
          </p>
        )}
        <div className="flex gap-8 items-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-6xl">{emoji(mine)}</span>
            <span className="text-xs text-base-content/50">You</span>
          </div>
          <span className="text-2xl text-base-content/30">vs</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-6xl">{emoji(theirs)}</span>
            <span className="text-xs text-base-content/50">Opponent</span>
          </div>
        </div>
        <p className={`text-2xl font-bold ${resultClass}`}>{resultLabel}</p>
      </div>
    );
  }

  // ── Tie sub-round reveal: lastChoices set, not finished ────────────────────
  // Show the tied result AND re-enable choice buttons for the next sub-round.
  if (s.lastChoices && !s.finished) {
    const mine = s.lastChoices[playerId] as Choice | undefined;
    const theirs = s.lastChoices[opponentId] as Choice | undefined;
    return (
      <div className="flex flex-col items-center gap-4 py-4 w-full select-none">
        <div className="flex items-center justify-between w-full px-2">
          <p className="text-xs text-base-content/40 uppercase tracking-widest">
            Sub-round {s.subRound - 1} — Tie!
          </p>
          <p className="badge badge-neutral tabular-nums">{Math.ceil(remainingMs / 1000)}s</p>
        </div>
        <div className="flex gap-8 items-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-5xl">{emoji(mine)}</span>
            <span className="text-xs text-base-content/50">You</span>
          </div>
          <span className="text-xl text-base-content/30">vs</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-5xl">{emoji(theirs)}</span>
            <span className="text-xs text-base-content/50">Opponent</span>
          </div>
        </div>
        <p className="badge badge-warning badge-lg">🔁 Sub-round {s.subRound} — pick again!</p>
        {!iChose ? (
          <div className="flex gap-3 w-full justify-center">
            {OPTIONS.map(({ v, label, e }) => (
              <button
                key={v}
                className="flex flex-col items-center gap-1 btn btn-outline h-auto py-4 px-5 active:scale-95 transition-transform"
                onPointerDown={(ev) => { ev.preventDefault(); onInput({ choice: v }); }}
              >
                <span className="text-5xl">{e}</span>
                <span className="text-xs">{label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 mt-2">
            <span className="loading loading-dots loading-md" />
            <p className="text-xs text-base-content/50">Waiting for opponent…</p>
          </div>
        )}
      </div>
    );
  }

  // ── Choosing ───────────────────────────────────────────────────────────────
  if (!iChose) {
    return (
      <div className="flex flex-col items-center gap-6 py-6 w-full select-none">
        <div className="flex items-center justify-between w-full px-2">
          {s.subRound > 1 && (
            <p className="text-xs text-base-content/50">Sub-round {s.subRound}</p>
          )}
          <p className="badge badge-neutral tabular-nums ml-auto">{Math.ceil(remainingMs / 1000)}s</p>
        </div>
        <p className="text-sm text-base-content/60">Choose your move</p>
        <div className="flex gap-3 w-full justify-center">
          {OPTIONS.map(({ v, label, e }) => (
            <button
              key={v}
              className="flex flex-col items-center gap-1 btn btn-outline h-auto py-4 px-5 active:scale-95 transition-transform"
              onPointerDown={(ev) => { ev.preventDefault(); onInput({ choice: v }); }}
            >
              <span className="text-5xl">{e}</span>
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Waiting for opponent ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-6 py-8 w-full">
      {s.subRound > 1 && (
        <p className="text-xs text-base-content/40 uppercase tracking-widest">
          Sub-round {s.subRound}
        </p>
      )}
      <p className="badge badge-neutral tabular-nums">{Math.ceil(remainingMs / 1000)}s</p>
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-base-content/60">You chose</p>
        <span className="text-7xl">{emoji(myChoice)}</span>
        {!oppChose ? (
          <div className="flex flex-col items-center gap-1 mt-2">
            <span className="loading loading-dots loading-md" />
            <p className="text-xs text-base-content/50">Waiting for opponent…</p>
          </div>
        ) : (
          <p className="badge badge-success text-sm">Both chosen — revealing…</p>
        )}
      </div>
    </div>
  );
}
