import { useRef, useState, useCallback } from "react";
import { GameComponentProps } from "./types";
import { Chip } from "@heroui/react";

// Must match server constants
const LAUNCH_X = 0.5;
const LAUNCH_Y = 0.85;
const BIN_X    = 0.5;
const BIN_Y    = 0.2;

const AREA_W = 320;
const AREA_H = 400;

interface Wind { wx: number; wy: number }
interface ThrowResult { scored: boolean; landX: number; landY: number }
interface State {
  wind: Wind;
  scores: Record<string, number>;
  throws: Record<string, number>;
  lastThrow: Record<string, ThrowResult | null>;
  done: boolean;
}

interface FlickAnim {
  key: number;
  scored: boolean;
  x: number; // pixel position
  y: number;
}

let _animKey = 0;

export default function PaperToss({ publicState, playerId, opponentId, onInput, remainingMs }: GameComponentProps) {
  const s = publicState as State;
  const myScore   = s.scores[playerId]  ?? 0;
  const oppScore  = s.scores[opponentId] ?? 0;
  const myThrows  = s.throws[playerId]  ?? 0;
  const wind      = s.wind;

  // Flick gesture state
  const flickStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const [anims, setAnims] = useState<FlickAnim[]>([]);
  const animTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Last throw result for brief animation
  const lastThrow = s.lastThrow[playerId];

  const spawnAnim = useCallback((scored: boolean, landX: number, landY: number) => {
    const key = _animKey++;
    const x = landX * AREA_W;
    const y = landY * AREA_H;
    setAnims((prev) => [...prev, { key, scored, x, y }]);
    const t = setTimeout(() => {
      setAnims((prev) => prev.filter((a) => a.key !== key));
      animTimers.current.delete(key);
    }, 1200);
    animTimers.current.set(key, t);
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    if (s.done || remainingMs <= 0) return;
    flickStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!flickStart.current) return;
    const dx = e.clientX - flickStart.current.x;
    const dy = e.clientY - flickStart.current.y;
    const dt = Math.max(1, Date.now() - flickStart.current.t) / 1000; // seconds
    flickStart.current = null;

    // Derive velocity from flick distance / time, normalized to play area
    const vxRaw = (dx / AREA_W) / dt;
    const vyRaw = (dy / AREA_H) / dt;

    // Only count meaningful flicks (upward direction preferred)
    const speed = Math.sqrt(vxRaw * vxRaw + vyRaw * vyRaw);
    if (speed < 0.05) return;

    onInput({ vx: vxRaw, vy: vyRaw });

    // Optimistic animation: show landing at rough predicted spot
    // Client doesn't simulate — just show animation at bin area when it roughly looks like a good toss
    const isUpward = vyRaw < 0;
    spawnAnim(false, isUpward ? BIN_X + (Math.random() - 0.5) * 0.3 : 0.5, isUpward ? BIN_Y + 0.1 : 0.7);
  }

  // Convert normalized to pixel
  const toX = (nx: number) => nx * AREA_W;
  const toY = (ny: number) => ny * AREA_H;

  // Wind direction for display
  const windAngle = Math.atan2(wind.wy, wind.wx) * 180 / Math.PI;
  const windSpeed = Math.sqrt(wind.wx * wind.wx + wind.wy * wind.wy).toFixed(1);

  return (
    <div className="flex flex-col items-center gap-3 py-2 w-full select-none" dir="ltr">
      {/* Score HUD */}
      <div className="flex justify-around w-full">
        <div className="flex flex-col items-center">
          <span className="text-xs text-(--muted) uppercase">You</span>
          <span className="text-3xl font-bold tabular-nums text-(--accent)">{myScore}</span>
          <span className="text-xs text-(--muted)">{myThrows} throws</span>
        </div>
        <Chip size="sm" color="default" variant="secondary" className="self-center">
          {Math.ceil(remainingMs / 1000)}s
        </Chip>
        <div className="flex flex-col items-center">
          <span className="text-xs text-(--muted) uppercase">Opponent</span>
          <span className="text-3xl font-bold tabular-nums text-(--success)">{oppScore}</span>
          <span className="text-xs text-(--muted)">{s.throws[opponentId] ?? 0} throws</span>
        </div>
      </div>

      {/* Wind indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-(--muted)">Wind</span>
        <svg
          width="20" height="20" viewBox="0 0 20 20"
          style={{ transform: `rotate(${windAngle}deg)` }}
        >
          <path d="M10 2 L10 18 M4 12 L10 18 L16 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-semibold text-(--accent)">{windSpeed}</span>
      </div>

      {/* Play area */}
      <div
        className="relative bg-(--surface-secondary) rounded-2xl overflow-hidden border border-(--border) touch-none"
        style={{ width: AREA_W, height: AREA_H }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {/* Bin */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            width: 56,
            height: 56,
            left: toX(BIN_X) - 28,
            top: toY(BIN_Y) - 28,
          }}
        >
          {/* Bin shape — top oval + body */}
          <svg width="56" height="56" viewBox="0 0 56 56">
            <ellipse cx="28" cy="10" rx="22" ry="8" fill="none" stroke="#64748b" strokeWidth="3" />
            <path d="M6 10 Q6 48 12 48 L44 48 Q50 48 50 10" fill="#1e293b" stroke="#64748b" strokeWidth="3" />
            <ellipse cx="28" cy="10" rx="22" ry="8" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
          </svg>
        </div>

        {/* Ball / launch point */}
        <div
          className="absolute rounded-full bg-(--accent) border-2 border-white shadow-md"
          style={{
            width: 22,
            height: 22,
            left: toX(LAUNCH_X) - 11,
            top: toY(LAUNCH_Y) - 11,
          }}
        >
          {/* Paper ball icon */}
          <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">📄</div>
        </div>

        {/* Last throw landing indicator */}
        {lastThrow && (
          <div
            className={`absolute rounded-full border-2 transition-all ${lastThrow.scored ? "bg-(--success)/40 border-(--success)" : "bg-(--danger)/30 border-(--danger)"}`}
            style={{
              width: 18,
              height: 18,
              left: toX(lastThrow.landX) - 9,
              top: toY(lastThrow.landY) - 9,
            }}
          />
        )}

        {/* Pop animations */}
        {anims.map((a) => (
          <div
            key={a.key}
            className={`absolute pointer-events-none font-bold text-xl leading-none ${a.scored ? "text-(--success)" : "text-(--muted)"}`}
            style={{
              left: a.x,
              top: a.y,
              transform: "translate(-50%, -50%)",
              animation: "paper-pop 1.2s ease-out forwards",
            }}
          >
            {a.scored ? "🗑️✓" : "💨"}
          </div>
        ))}

        {s.done && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
            <span className="text-white text-2xl font-bold">Time's up!</span>
          </div>
        )}
      </div>

      <p className="text-xs text-(--muted) text-center">Flick up to toss the paper</p>

      <style>{`
        @keyframes paper-pop {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(1.3); }
          40%  { opacity: 1; transform: translate(-50%, calc(-50% - 20px)) scale(1.1); }
          100% { opacity: 0; transform: translate(-50%, calc(-50% - 50px)) scale(0.9); }
        }
      `}</style>
    </div>
  );
}
