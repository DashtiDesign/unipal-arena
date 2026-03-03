import { useCallback, useRef, useState } from "react";
import { GameComponentProps } from "./types";

interface State { taps: Record<string, number>; done: boolean }

interface FloatAnim { key: number; x: number; y: number }
let _floatKey = 0;

export default function TappingSpeed({ publicState, playerId, onInput, remainingMs }: GameComponentProps) {
  const s = publicState as State;
  const myTaps = s.taps[playerId] ?? 0;

  const [pressed, setPressed] = useState(false);
  const [floats, setFloats] = useState<FloatAnim[]>([]);
  const floatTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const buttonRef = useRef<HTMLButtonElement>(null);

  const spawnFloat = useCallback((clientX: number, clientY: number) => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const key = _floatKey++;
    setFloats((prev) => [...prev, { key, x, y }]);
    const t = setTimeout(() => {
      setFloats((prev) => prev.filter((f) => f.key !== key));
      floatTimers.current.delete(key);
    }, 800);
    floatTimers.current.set(key, t);
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (s.done) return;
    setPressed(true);
    spawnFloat(e.clientX, e.clientY);
    onInput({});
  }

  function handlePointerUp() {
    setPressed(false);
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6 w-full select-none">
      <div className="flex flex-col items-center">
        <span className="text-sm text-(--muted) uppercase tracking-wide">Your taps</span>
        <span className="text-5xl font-bold tabular-nums text-(--accent)">{myTaps}</span>
      </div>

      <p className="text-base text-(--muted) tabular-nums">{Math.ceil(remainingMs / 1000)}s left</p>

      <div className="relative w-full overflow-hidden rounded-2xl" style={{ touchAction: "none" }}>
        <button
          ref={buttonRef}
          className={`w-full rounded-2xl flex items-center justify-center text-5xl font-bold transition-transform duration-75 ${
            s.done
              ? "bg-(--surface-secondary) text-(--muted) cursor-not-allowed"
              : pressed
              ? "bg-(--accent)/80 text-(--accent-foreground) scale-95"
              : "bg-(--accent) text-(--accent-foreground)"
          }`}
          style={{ height: "220px", touchAction: "none" }}
          disabled={s.done}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {s.done ? "⏱" : "TAP!"}
        </button>

        {/* Floating +1 animations at tap position — pointer-events: none */}
        {floats.map((f) => (
          <div
            key={f.key}
            className="absolute pointer-events-none font-bold text-2xl leading-none text-(--success)"
            style={{
              left: f.x,
              top: f.y,
              transform: "translate(-50%, -50%)",
              animation: "tap-float 0.8s ease-out forwards",
            }}
          >
            +1
          </div>
        ))}
      </div>

      <style>{`
        @keyframes tap-float {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(1.3); }
          40%  { opacity: 1; transform: translate(-50%, calc(-50% - 28px)) scale(1.1); }
          100% { opacity: 0; transform: translate(-50%, calc(-50% - 64px)) scale(0.9); }
        }
      `}</style>
    </div>
  );
}
