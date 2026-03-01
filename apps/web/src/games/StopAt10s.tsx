import { useState, useEffect, useRef } from "react";
import { GameComponentProps } from "./types";

interface State {
  startAt: number;
  stopped: Record<string, boolean>;
  stopTimes: Record<string, number | null>;
}

const TARGET_MS = 10000;

export default function StopAt10s({ publicState, playerId, opponentId, onInput }: GameComponentProps) {
  const s = publicState as State;
  const myStopped = s.stopped[playerId] ?? false;
  const oppStopped = s.stopped[opponentId] ?? false;
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Sync timer to server's startAt for accuracy
  useEffect(() => {
    if (myStopped) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    function tick() {
      setElapsed(Date.now() - s.startAt);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [myStopped, s.startAt]);

  function handleStop(e: React.PointerEvent) {
    e.preventDefault();
    if (!myStopped) onInput({});
  }

  const myTime   = s.stopTimes[playerId];
  const oppTime  = s.stopTimes[opponentId];
  const showResults = myTime != null || oppTime != null;

  function formatMs(ms: number | null) {
    if (ms == null) return "—";
    return (ms / 1000).toFixed(3) + "s";
  }

  function diffBadge(ms: number | null) {
    if (ms == null) return null;
    const diff = ms - TARGET_MS;
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${(diff / 1000).toFixed(3)}s`;
  }

  const displayMs = myStopped ? (myTime ?? elapsed) : elapsed;
  const timerColor =
    displayMs < 9000 ? "text-base-content" :
    displayMs < 9800 ? "text-warning" :
    displayMs <= 10200 ? "text-success" :
    "text-error";

  return (
    <div className="flex flex-col items-center gap-5 py-6 w-full select-none">
      <p className="text-sm text-base-content/60">Stop as close to 10.000s as possible</p>

      {/* Big timer */}
      <p className={`text-7xl font-mono font-bold tabular-nums transition-colors ${timerColor}`}>
        {(displayMs / 1000).toFixed(3)}
        <span className="text-3xl">s</span>
      </p>

      {/* Target marker */}
      <div className="w-full max-w-xs relative h-3 bg-base-300 rounded-full overflow-hidden">
        <div
          className="absolute top-0 h-full bg-success/30 transition-none"
          style={{ left: "83.33%", width: "1px", backgroundColor: "oklch(var(--su))" }}
        />
        <div
          className="h-full bg-primary transition-none rounded-full"
          style={{ width: `${Math.min((displayMs / 12000) * 100, 100)}%` }}
        />
        {/* 10s marker */}
        <div className="absolute top-0 h-full w-0.5 bg-success" style={{ left: "83.33%" }} />
      </div>
      <p className="text-xs text-base-content/40">▲ 10.000s target</p>

      {/* STOP button */}
      <button
        className={`w-56 h-56 rounded-full flex items-center justify-center text-4xl font-bold select-none active:scale-95 transition-transform
          ${myStopped ? "bg-base-300 text-base-content/50 cursor-not-allowed" : "bg-primary text-primary-content"}`}
        style={{ touchAction: "none" }}
        onPointerDown={handleStop}
      >
        {myStopped ? "✓ Stopped!" : "STOP"}
      </button>

      {/* Waiting indicator */}
      {myStopped && !showResults && (
        <div className="flex flex-col items-center gap-1">
          <span className="loading loading-dots loading-md" />
          <p className="text-xs text-base-content/50">Waiting for opponent…</p>
        </div>
      )}

      {/* Results revealed once both stopped */}
      {showResults && (
        <div className="w-full max-w-xs flex flex-col gap-2">
          <div className="flex justify-between items-center p-3 bg-base-200 rounded-xl">
            <span className="text-sm font-semibold">You</span>
            <div className="text-right">
              <p className="font-mono font-bold">{formatMs(myTime)}</p>
              <p className="text-xs text-base-content/50">{diffBadge(myTime)}</p>
            </div>
          </div>
          <div className="flex justify-between items-center p-3 bg-base-200 rounded-xl">
            <span className="text-sm font-semibold">Opponent</span>
            <div className="text-right">
              <p className="font-mono font-bold">{formatMs(oppTime)}</p>
              <p className="text-xs text-base-content/50">{diffBadge(oppTime)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
