import { useRef, useState } from "react";
import { GameComponentProps } from "./types";
import { Chip } from "@heroui/react";

const BOARD_SIZE = 280; // px, square
const CENTER = BOARD_SIZE / 2;

// Zone radii as fraction of half-board-size, must match server ZONES
const ZONES = [
  { maxR: 0.07, color: "#dc2626", label: "Bullseye", score: 50 },
  { maxR: 0.17, color: "#16a34a", label: "Bull",     score: 25 },
  { maxR: 0.42, color: "#1d4ed8", label: "Inner",    score: 10 },
  { maxR: 0.72, color: "#d97706", label: "Outer",    score: 5  },
  { maxR: 1.00, color: "#374151", label: "Edge",     score: 2  },
];

interface DartThrow { aimX: number; aimY: number; landX: number; landY: number; score: number; zone: string }
interface State {
  throwCount: Record<string, number>;
  throws: Record<string, DartThrow[]>;
  totals: Record<string, number>;
  maxThrows: number;
  done: boolean;
}

const MAX_HOLD_MS = 1500;

export default function Darts({ publicState, playerId, opponentId, onInput, remainingMs }: GameComponentProps) {
  const s = publicState as State;
  const myThrows   = s.throws[playerId]   ?? [];
  const oppThrows  = s.throws[opponentId] ?? [];
  const myTotal    = s.totals[playerId]   ?? 0;
  const oppTotal   = s.totals[opponentId] ?? 0;
  const myCount    = s.throwCount[playerId]   ?? 0;
  const maxThrows  = s.maxThrows ?? 3;
  const canThrow   = myCount < maxThrows && !s.done && remainingMs > 0;

  // Aim point (normalized 0..1)
  const [aimPos, setAimPos] = useState<{ x: number; y: number } | null>(null);
  // Hold for power
  const holdStart = useRef<number | null>(null);
  const [holdMs, setHoldMs]   = useState(0);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  function normalizeToBoard(clientX: number, clientY: number): { x: number; y: number } {
    const rect = boardRef.current!.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top)  / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!canThrow || !boardRef.current) return;
    const pos = normalizeToBoard(e.clientX, e.clientY);
    setAimPos(pos);
    holdStart.current = Date.now();
    setHoldMs(0);
    if (holdInterval.current) clearInterval(holdInterval.current);
    holdInterval.current = setInterval(() => {
      setHoldMs(Date.now() - (holdStart.current ?? Date.now()));
    }, 30);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!holdStart.current || !boardRef.current) return;
    const pos = normalizeToBoard(e.clientX, e.clientY);
    setAimPos(pos);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!holdStart.current || !aimPos) return;
    const finalHoldMs = Date.now() - holdStart.current;
    holdStart.current = null;
    setHoldMs(0);
    if (holdInterval.current) { clearInterval(holdInterval.current); holdInterval.current = null; }

    if (!canThrow) { setAimPos(null); return; }

    onInput({ aimX: aimPos.x, aimY: aimPos.y, holdMs: Math.min(MAX_HOLD_MS, finalHoldMs) });
    setAimPos(null);
  }

  // Power bar fill
  const powerFill = Math.min(1, holdMs / MAX_HOLD_MS);

  // Dart dot pixel position on board
  function toPixel(nx: number, ny: number) {
    return { px: nx * BOARD_SIZE, py: ny * BOARD_SIZE };
  }

  return (
    <div className="flex flex-col items-center gap-3 py-2 w-full select-none" dir="ltr">
      {/* Score HUD */}
      <div className="flex justify-around w-full">
        <div className="flex flex-col items-center">
          <span className="text-xs text-(--muted) uppercase">You</span>
          <span className="text-3xl font-bold tabular-nums text-(--accent)">{myTotal}</span>
          <span className="text-xs text-(--muted)">{myCount}/{maxThrows} darts</span>
        </div>
        <Chip size="sm" color="default" variant="secondary" className="self-center">
          {Math.ceil(remainingMs / 1000)}s
        </Chip>
        <div className="flex flex-col items-center">
          <span className="text-xs text-(--muted) uppercase">Opponent</span>
          <span className="text-3xl font-bold tabular-nums text-(--success)">{oppTotal}</span>
          <span className="text-xs text-(--muted)">{s.throwCount[opponentId] ?? 0}/{maxThrows} darts</span>
        </div>
      </div>

      {/* Dartboard */}
      <div
        ref={boardRef}
        className="relative rounded-full overflow-hidden touch-none border-4 border-(--border)"
        style={{ width: BOARD_SIZE, height: BOARD_SIZE, cursor: canThrow ? "crosshair" : "default" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Concentric rings */}
        <svg width={BOARD_SIZE} height={BOARD_SIZE} viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}>
          {[...ZONES].reverse().map((zone) => (
            <circle
              key={zone.label}
              cx={CENTER}
              cy={CENTER}
              r={zone.maxR * CENTER}
              fill={zone.color}
              stroke="#111"
              strokeWidth="1"
            />
          ))}
          {/* Cross-hair lines */}
          <line x1={CENTER} y1="0" x2={CENTER} y2={BOARD_SIZE} stroke="#0005" strokeWidth="1" />
          <line x1="0" y1={CENTER} x2={BOARD_SIZE} y2={CENTER} stroke="#0005" strokeWidth="1" />
        </svg>

        {/* My past throws */}
        {myThrows.map((t, i) => {
          const { px, py } = toPixel(t.landX, t.landY);
          return (
            <div
              key={i}
              className="absolute rounded-full bg-yellow-300 border border-yellow-600 pointer-events-none z-10"
              style={{ width: 10, height: 10, left: px - 5, top: py - 5 }}
              title={`${t.zone}: ${t.score}pts`}
            />
          );
        })}

        {/* Opponent past throws */}
        {oppThrows.map((t, i) => {
          const { px, py } = toPixel(t.landX, t.landY);
          return (
            <div
              key={i}
              className="absolute rounded-full bg-blue-300 border border-blue-600 pointer-events-none z-10 opacity-60"
              style={{ width: 8, height: 8, left: px - 4, top: py - 4 }}
            />
          );
        })}

        {/* Aim crosshair */}
        {aimPos && (
          <div
            className="absolute pointer-events-none z-20"
            style={{ left: aimPos.x * BOARD_SIZE - 12, top: aimPos.y * BOARD_SIZE - 12 }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" fill="none" stroke="white" strokeWidth="2" opacity="0.9" />
              <line x1="12" y1="0" x2="12" y2="24" stroke="white" strokeWidth="1.5" opacity="0.9" />
              <line x1="0" y1="12" x2="24" y2="12" stroke="white" strokeWidth="1.5" opacity="0.9" />
            </svg>
          </div>
        )}

        {s.done && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
            <span className="text-white text-xl font-bold">Done!</span>
          </div>
        )}
      </div>

      {/* Zone legend */}
      <div className="flex gap-2 flex-wrap justify-center">
        {ZONES.map((z) => (
          <span key={z.label} className="text-xs flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full border" style={{ background: z.color }} />
            {z.label} {z.score}
          </span>
        ))}
      </div>

      {/* Power bar */}
      {aimPos && canThrow && (
        <div className="w-full max-w-[280px] flex flex-col gap-1">
          <div className="flex justify-between text-xs text-(--muted)">
            <span>Power</span>
            <span>{Math.round(powerFill * 100)}%</span>
          </div>
          <div className="w-full bg-(--surface-secondary) rounded-full h-3">
            <div
              className="h-3 rounded-full transition-none"
              style={{ width: `${powerFill * 100}%`, background: `hsl(${120 - powerFill * 120}, 70%, 45%)` }}
            />
          </div>
          <p className="text-xs text-(--muted) text-center">Hold longer for more power → less wobble</p>
        </div>
      )}

      {!canThrow && !s.done && myCount >= maxThrows && (
        <p className="text-sm text-(--muted)">Waiting for opponent…</p>
      )}

      {/* Per-throw scores */}
      {myThrows.length > 0 && (
        <div className="flex gap-2">
          {myThrows.map((t, i) => (
            <Chip key={i} size="sm" color={t.score >= 25 ? "success" : t.score >= 10 ? "accent" : "default"} variant="soft">
              {t.zone}: {t.score}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
