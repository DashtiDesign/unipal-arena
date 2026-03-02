import { useState, useEffect, useRef } from "react";
import { GameComponentProps } from "./types";
import { Spinner } from "@heroui/react";

interface State {
  startAt: number;
  stopped: Record<string, boolean>;
  stopTimes: Record<string, number | null>;
}

export default function StopAt10s({ publicState, playerId, onInput }: GameComponentProps) {
  const s = publicState as State;
  const myStopped = s.stopped[playerId] ?? false;
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);

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

  const displayMs = myStopped ? (s.stopTimes[playerId] ?? elapsed) : elapsed;
  const timerColor =
    displayMs < 9000 ? "text-(--foreground)" :
    displayMs < 10000 ? "text-(--warning)" :
    "text-(--danger)";

  return (
    <div className="flex flex-col items-center gap-6 py-6 w-full select-none">
      <p className="text-sm text-(--muted)">Stop as close to 10.000s as possible</p>

      <p className={`text-7xl font-mono font-bold tabular-nums transition-colors ${timerColor}`}>
        {(displayMs / 1000).toFixed(3)}
        <span className="text-3xl">s</span>
      </p>

      {myStopped ? (
        <div className="flex flex-col items-center gap-2">
          <Spinner size="md" />
          <p className="text-sm text-(--muted)">Stopped — waiting for opponent…</p>
        </div>
      ) : (
        <button
          className="w-56 h-56 rounded-full flex items-center justify-center text-4xl font-bold select-none active:scale-95 transition-transform bg-(--accent) text-(--accent-foreground)"
          style={{ touchAction: "none" }}
          onPointerDown={handleStop}
        >
          STOP
        </button>
      )}
    </div>
  );
}
