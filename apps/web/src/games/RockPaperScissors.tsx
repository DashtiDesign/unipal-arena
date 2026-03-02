import { GameComponentProps } from "./types";
import { Button, Chip, Spinner } from "@heroui/react";

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

  if (s.finished && s.choices) {
    const mine = s.choices[playerId] as Choice | undefined;
    const theirs = s.choices[opponentId] as Choice | undefined;

    let resultLabel = "";
    let resultClass = "";
    if (!mine) {
      resultLabel = "You didn't pick — you lose!";
      resultClass = "text-(--danger)";
    } else if (!theirs) {
      resultLabel = "Opponent didn't pick — you win!";
      resultClass = "text-(--success)";
    } else if (beats[mine] === theirs) {
      resultLabel = "You win!";
      resultClass = "text-(--success)";
    } else {
      resultLabel = "You lose!";
      resultClass = "text-(--danger)";
    }

    return (
      <div className="flex flex-col items-center gap-6 py-8 w-full">
        {s.subRound > 1 && <p className="text-xs text-(--muted) uppercase tracking-widest">After {s.subRound} sub-rounds</p>}
        <div className="flex gap-8 items-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-6xl">{emoji(mine)}</span>
            <span className="text-xs text-(--muted)">You</span>
          </div>
          <span className="text-2xl text-(--muted)">vs</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-6xl">{emoji(theirs)}</span>
            <span className="text-xs text-(--muted)">Opponent</span>
          </div>
        </div>
        <p className={`text-2xl font-bold ${resultClass}`}>{resultLabel}</p>
      </div>
    );
  }

  if (s.lastChoices && !s.finished) {
    const mine = s.lastChoices[playerId] as Choice | undefined;
    const theirs = s.lastChoices[opponentId] as Choice | undefined;
    return (
      <div className="flex flex-col items-center gap-4 py-4 w-full select-none">
        <div className="flex items-center justify-between w-full px-2">
          <p className="text-xs text-(--muted) uppercase tracking-widest">Sub-round {s.subRound - 1} — Tie!</p>
          <Chip size="sm" color="default" variant="secondary">{Math.ceil(remainingMs / 1000)}s</Chip>
        </div>
        <div className="flex gap-8 items-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-5xl">{emoji(mine)}</span>
            <span className="text-xs text-(--muted)">You</span>
          </div>
          <span className="text-xl text-(--muted)">vs</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-5xl">{emoji(theirs)}</span>
            <span className="text-xs text-(--muted)">Opponent</span>
          </div>
        </div>
        <Chip size="lg" color="warning" variant="soft">🔁 Sub-round {s.subRound} — pick again!</Chip>
        {!iChose ? (
          <div className="flex gap-3 w-full justify-center">
            {OPTIONS.map(({ v, label, e }) => (
              <button
                key={v}
                className="flex flex-col items-center gap-1 border border-(--border) rounded-xl py-4 px-5 active:scale-95 transition-transform bg-(--surface) hover:bg-(--surface-secondary)"
                onPointerDown={(ev) => { ev.preventDefault(); onInput({ choice: v }); }}
              >
                <span className="text-5xl">{e}</span>
                <span className="text-xs">{label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 mt-2">
            <Spinner size="md" />
            <p className="text-xs text-(--muted)">Waiting for opponent…</p>
          </div>
        )}
      </div>
    );
  }

  if (!iChose) {
    return (
      <div className="flex flex-col items-center gap-6 py-6 w-full select-none">
        <div className="flex items-center justify-between w-full px-2">
          {s.subRound > 1 && <p className="text-xs text-(--muted)">Sub-round {s.subRound}</p>}
          <Chip size="sm" color="default" variant="secondary" className="ml-auto">{Math.ceil(remainingMs / 1000)}s</Chip>
        </div>
        <p className="text-sm text-(--muted)">Choose your move</p>
        <div className="flex gap-3 w-full justify-center">
          {OPTIONS.map(({ v, label, e }) => (
            <button
              key={v}
              className="flex flex-col items-center gap-1 border border-(--border) rounded-xl py-4 px-5 active:scale-95 transition-transform bg-(--surface) hover:bg-(--surface-secondary)"
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

  return (
    <div className="flex flex-col items-center gap-6 py-8 w-full">
      {s.subRound > 1 && <p className="text-xs text-(--muted) uppercase tracking-widest">Sub-round {s.subRound}</p>}
      <Chip size="sm" color="default" variant="secondary">{Math.ceil(remainingMs / 1000)}s</Chip>
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-(--muted)">You chose</p>
        <span className="text-7xl">{emoji(myChoice)}</span>
        {!oppChose ? (
          <div className="flex flex-col items-center gap-1 mt-2">
            <Spinner size="md" />
            <p className="text-xs text-(--muted)">Waiting for opponent…</p>
          </div>
        ) : (
          <Chip size="sm" color="success" variant="soft">Both chosen — revealing…</Chip>
        )}
      </div>
    </div>
  );
}
