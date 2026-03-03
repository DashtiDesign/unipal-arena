import { useState, useEffect, useRef } from "react";
import { GameComponentProps } from "./types";
import { Spinner } from "@heroui/react";

interface PlayerResult {
  correct: boolean;
  elapsedMs: number;
}

interface State {
  targets: number[] | null;
  showUntil: number;
  tappedCount: Record<string, number>;
  results: Record<string, PlayerResult> | null;
  numCells: number;
}

export default function MemoryGrid({
  publicState, playerId, opponentId, onInput, remainingMs,
}: GameComponentProps) {
  const s = publicState as State;
  const [now, setNow] = useState(Date.now);
  // tapped is purely local optimistic state — reset whenever showUntil changes (new game)
  const [tapped, setTapped] = useState<number[]>([]);
  const prevShowUntilRef = useRef(s.showUntil);

  useEffect(() => {
    if (prevShowUntilRef.current !== s.showUntil) {
      prevShowUntilRef.current = s.showUntil;
      setTapped([]); // new game round — reset local tapped
    }
  }, [s.showUntil]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const revealing = now < s.showUntil;
  const serverDone = (s.tappedCount[playerId] ?? 0) >= s.numCells;
  const iDone = serverDone || tapped.length >= s.numCells;
  const oppDone = (s.tappedCount[opponentId] ?? 0) >= s.numCells;

  if (s.results) {
    const mine = s.results[playerId];
    const theirs = s.results[opponentId];
    const iWon = mine?.correct && (!theirs?.correct || mine.elapsedMs < theirs.elapsedMs);
    const isDraw = mine?.correct && theirs?.correct && Math.abs(mine.elapsedMs - theirs.elapsedMs) <= 50;

    return (
      <div className="flex flex-col items-center gap-4 py-6 w-full">
        <p className="text-4xl">{isDraw ? "🤝" : iWon ? "🎉" : "😢"}</p>
        <p className="text-xl font-bold">
          {isDraw ? "Draw!" : iWon ? "You remembered!" : mine?.correct ? "Too slow!" : "Wrong selection!"}
        </p>
        <div className="w-full flex flex-col gap-2 max-w-xs">
          {[{ label: "You", result: mine }, { label: "Opponent", result: theirs }].map(({ label, result }) => (
            <div key={label} className="flex items-center justify-between p-3 bg-(--surface-secondary) rounded-xl">
              <span className="text-sm font-semibold">{label}</span>
              <div className="text-right">
                <p className={`font-bold text-sm ${result?.correct ? "text-(--success)" : "text-(--danger)"}`}>
                  {result?.correct ? "✓ Correct" : "✗ Wrong"}
                </p>
                <p className="text-xs text-(--muted) tabular-nums">
                  {result?.correct ? `${(result.elapsedMs / 1000).toFixed(2)}s` : "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function handleTap(i: number) {
    if (revealing || iDone) return;
    if (tapped.includes(i)) return;
    const next = [...tapped, i];
    setTapped(next);
    onInput({ cell: i });
  }

  function cellClass(i: number): string {
    if (revealing) {
      return s.targets?.includes(i) ? "bg-(--warning) scale-105 shadow-lg" : "bg-(--surface-secondary)";
    }
    if (tapped.includes(i)) return "bg-(--accent) text-(--accent-foreground)";
    if (iDone) return "bg-(--surface-secondary) opacity-40 cursor-not-allowed";
    return "bg-(--surface-secondary) hover:bg-(--surface-tertiary) active:scale-90";
  }

  const revealSecondsLeft = Math.max(0, Math.ceil((s.showUntil - now) / 1000));

  if (iDone) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 w-full">
        <p className="text-(--success) text-lg font-bold">✓ Done!</p>
        <div className="flex flex-col items-center gap-1 mt-2">
          <Spinner size="md" />
          <p className="text-xs text-(--muted)">Waiting for opponent…</p>
        </div>
        <span className="text-sm text-(--muted) tabular-nums">{Math.ceil(remainingMs / 1000)}s</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4 w-full select-none">
      <div className="flex items-center justify-between w-full px-2">
        <p className="text-sm font-semibold text-(--foreground)">
          {revealing ? `Memorize! (${revealSecondsLeft}s)` : `Tap the ${s.numCells} cells you saw`}
        </p>
        <span className="text-sm text-(--muted) tabular-nums">{Math.ceil(remainingMs / 1000)}s</span>
      </div>

      <div className="grid grid-cols-4 gap-2 w-full max-w-xs">
        {Array.from({ length: 16 }, (_, i) => (
          <button
            key={i}
            className={`aspect-square rounded-xl text-2xl transition-all duration-150 ${cellClass(i)}`}
            style={{ touchAction: "none" }}
            onPointerDown={(e) => { e.preventDefault(); handleTap(i); }}
          >
            {revealing && s.targets?.includes(i) ? "⭐" : ""}
          </button>
        ))}
      </div>

      {!revealing && <p className="text-xs text-(--muted)">{tapped.length}/{s.numCells} tapped</p>}
      {oppDone && !iDone && <p className="text-xs text-(--muted)">Opponent finished!</p>}
    </div>
  );
}
