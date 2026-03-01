import { useState, useEffect } from "react";
import { GameComponentProps } from "./types";

interface PlayerResult {
  correct: boolean;
  elapsedMs: number;
}

interface State {
  targets: number[] | null;  // non-null during reveal phase
  showUntil: number;         // epoch ms
  tappedCount: Record<string, number>;
  locked: Record<string, boolean>;
  results: Record<string, PlayerResult> | null;
  numCells: number;
}

export default function MemoryGrid({
  publicState, playerId, opponentId, onInput, remainingMs,
}: GameComponentProps) {
  const s = publicState as State;
  const [now, setNow] = useState(Date.now);
  const [tapped, setTapped] = useState<number[]>([]);

  // Tick every 100ms to transition reveal → recall without a server round-trip
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const revealing = now < s.showUntil;
  const iLocked   = s.locked[playerId] ?? false;
  const oppLocked = s.locked[opponentId] ?? false;
  const iDone     = iLocked || !!(s.results); // finished when results are revealed

  // Both done — show results
  if (s.results) {
    const mine = s.results[playerId];
    const theirs = s.results[opponentId];
    const iWon = mine?.correct && (!theirs?.correct || mine.elapsedMs < theirs.elapsedMs);
    const isDraw = mine?.correct && theirs?.correct && Math.abs(mine.elapsedMs - theirs.elapsedMs) <= 50;

    return (
      <div className="flex flex-col items-center gap-4 py-6 w-full">
        <p className="text-4xl">{isDraw ? "🤝" : iWon ? "🎉" : "😢"}</p>
        <p className="text-xl font-bold">
          {isDraw ? "Draw!" : iWon ? "You remembered!" : mine?.correct ? "Too slow!" : "Wrong tap!"}
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
    if (revealing || iLocked || iDone) return;
    if (tapped.includes(i)) return;
    const next = [...tapped, i];
    setTapped(next);
    onInput({ cell: i });
  }

  function cellClass(i: number): string {
    if (revealing) {
      return s.targets?.includes(i)
        ? "bg-warning scale-105 shadow-lg"
        : "bg-base-300";
    }
    if (tapped.includes(i)) return "bg-primary text-primary-content";
    if (iLocked) return "bg-base-300 opacity-40 cursor-not-allowed";
    return "bg-base-200 hover:bg-base-300 active:scale-90";
  }

  const revealSecondsLeft = Math.max(0, Math.ceil((s.showUntil - now) / 1000));

  // After locking, show waiting state until opponent also finishes
  if (iLocked) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 w-full">
        <p className="text-error text-lg font-bold">❌ Wrong tap — locked out!</p>
        <div className="flex flex-col items-center gap-1 mt-2">
          <span className="loading loading-dots loading-md" />
          <p className="text-xs text-base-content/50">Waiting for opponent…</p>
        </div>
        <p className="badge badge-neutral tabular-nums">{Math.ceil(remainingMs / 1000)}s</p>
      </div>
    );
  }

  // After completing all cells correctly, show waiting state
  if (s.tappedCount[playerId] >= s.numCells && !iLocked) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 w-full">
        <p className="text-success text-lg font-bold">✓ Done!</p>
        <div className="flex flex-col items-center gap-1 mt-2">
          <span className="loading loading-dots loading-md" />
          <p className="text-xs text-base-content/50">Waiting for opponent…</p>
        </div>
        <p className="badge badge-neutral tabular-nums">{Math.ceil(remainingMs / 1000)}s</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4 w-full select-none">
      <div className="flex items-center justify-between w-full px-2">
        <p className="text-sm font-semibold text-base-content/70">
          {revealing
            ? `Memorize! (${revealSecondsLeft}s)`
            : `Tap the ${s.numCells} cells you saw`}
        </p>
        <p className="badge badge-neutral tabular-nums">{Math.ceil(remainingMs / 1000)}s</p>
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

      {/* Progress */}
      {!revealing && (
        <p className="text-xs text-base-content/40">
          {tapped.length}/{s.numCells} tapped
        </p>
      )}

      {/* Opponent status */}
      {oppLocked && (
        <p className="text-xs text-base-content/40">Opponent made a wrong tap!</p>
      )}
    </div>
  );
}
