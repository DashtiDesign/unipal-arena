import { useState, useEffect } from "react";
import { GameComponentProps } from "./types";

interface State {
  targets: number[] | null;  // non-null during reveal phase
  showUntil: number;         // epoch ms
  tappedCount: Record<string, number>;
  locked: Record<string, boolean>;
  firstCorrect: string | null;
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
  const ILocked   = s.locked[playerId] ?? false;
  const oppLocked = s.locked[opponentId] ?? false;
  const IWon      = s.firstCorrect === playerId;
  const ILost     = s.firstCorrect !== null && s.firstCorrect !== playerId;

  if (IWon || ILost) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-5xl">{IWon ? "🎉" : "😢"}</p>
        <p className="text-2xl font-bold">{IWon ? "You remembered!" : "Opponent was first!"}</p>
      </div>
    );
  }

  function handleTap(i: number) {
    if (revealing || ILocked || s.firstCorrect) return;
    if (tapped.includes(i)) return;
    const next = [...tapped, i];
    setTapped(next);
    onInput({ cell: i });
  }

  function cellClass(i: number): string {
    // During reveal: show targets highlighted
    if (revealing) {
      return s.targets?.includes(i)
        ? "bg-warning scale-105 shadow-lg"
        : "bg-base-300";
    }
    // Post-reveal: show tapped cells
    if (tapped.includes(i)) return "bg-primary text-primary-content";
    if (ILocked) return "bg-base-300 opacity-40 cursor-not-allowed";
    return "bg-base-200 hover:bg-base-300 active:scale-90";
  }

  const revealSecondsLeft = Math.max(0, Math.ceil((s.showUntil - now) / 1000));

  return (
    <div className="flex flex-col items-center gap-4 py-4 w-full select-none">
      <div className="flex items-center justify-between w-full px-2">
        <p className="text-sm font-semibold text-base-content/70">
          {revealing
            ? `Memorize! (${revealSecondsLeft}s)`
            : ILocked ? "❌ Wrong tap — locked out!"
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
      {!revealing && !ILocked && (
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
