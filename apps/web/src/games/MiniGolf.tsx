import { useRef, useState } from "react";
import { GameComponentProps } from "./types";
import { Chip } from "@heroui/react";

const AREA = 300; // square px

// Must match server COURSES — same coordinate system
interface Rect { x: number; y: number; w: number; h: number }
interface Course {
  id: number;
  name: string;
  ballStart: { x: number; y: number };
  hole: { x: number; y: number };
  walls: Rect[];
}

const COURSES: Course[] = [
  {
    id: 0, name: "Straight Shot",
    ballStart: { x: 0.5, y: 0.85 }, hole: { x: 0.5, y: 0.15 },
    walls: [{ x: 0.1, y: 0.40, w: 0.25, h: 0.06 }, { x: 0.65, y: 0.40, w: 0.25, h: 0.06 }],
  },
  {
    id: 1, name: "Dog Leg Right",
    ballStart: { x: 0.15, y: 0.8 }, hole: { x: 0.8, y: 0.2 },
    walls: [{ x: 0.35, y: 0.55, w: 0.06, h: 0.35 }, { x: 0.35, y: 0.55, w: 0.35, h: 0.06 }],
  },
  {
    id: 2, name: "Corridor",
    ballStart: { x: 0.5, y: 0.85 }, hole: { x: 0.5, y: 0.15 },
    walls: [{ x: 0.1, y: 0.1, w: 0.28, h: 0.8 }, { x: 0.62, y: 0.1, w: 0.28, h: 0.8 }],
  },
  {
    id: 3, name: "Island Green",
    ballStart: { x: 0.5, y: 0.85 }, hole: { x: 0.5, y: 0.2 },
    walls: [{ x: 0.05, y: 0.45, w: 0.35, h: 0.10 }, { x: 0.60, y: 0.45, w: 0.35, h: 0.10 }, { x: 0.20, y: 0.25, w: 0.60, h: 0.06 }],
  },
  {
    id: 4, name: "Zigzag",
    ballStart: { x: 0.1, y: 0.85 }, hole: { x: 0.9, y: 0.15 },
    walls: [{ x: 0.30, y: 0.30, w: 0.06, h: 0.50 }, { x: 0.60, y: 0.20, w: 0.06, h: 0.50 }],
  },
  {
    id: 5, name: "Windmill Alley",
    ballStart: { x: 0.5, y: 0.88 }, hole: { x: 0.5, y: 0.12 },
    walls: [{ x: 0.15, y: 0.55, w: 0.30, h: 0.06 }, { x: 0.55, y: 0.55, w: 0.30, h: 0.06 }, { x: 0.15, y: 0.30, w: 0.30, h: 0.06 }, { x: 0.55, y: 0.30, w: 0.30, h: 0.06 }],
  },
  {
    id: 6, name: "The Bounce",
    ballStart: { x: 0.1, y: 0.5 }, hole: { x: 0.9, y: 0.5 },
    walls: [{ x: 0.30, y: 0.10, w: 0.06, h: 0.55 }, { x: 0.64, y: 0.35, w: 0.06, h: 0.55 }],
  },
  {
    id: 7, name: "Corner Pocket",
    ballStart: { x: 0.15, y: 0.82 }, hole: { x: 0.82, y: 0.15 },
    walls: [{ x: 0.38, y: 0.38, w: 0.24, h: 0.24 }, { x: 0.05, y: 0.05, w: 0.20, h: 0.06 }, { x: 0.75, y: 0.75, w: 0.20, h: 0.06 }],
  },
];

interface Shot { angle: number; power: number; finalX: number; finalY: number; distToHole: number }
interface State {
  courseId: number;
  shots: Record<string, Shot | null>;
  done: boolean;
}

export default function MiniGolf({ publicState, playerId, opponentId, onInput, remainingMs }: GameComponentProps) {
  const s = publicState as State;
  const course = COURSES[s.courseId] ?? COURSES[0];
  const myShot  = s.shots[playerId]   ?? null;
  const oppShot = s.shots[opponentId] ?? null;
  const canShoot = myShot === null && !s.done && remainingMs > 0;

  // Aim: user drags from ball to set angle
  // Hold duration sets power
  const aimRef = useRef<{ startX: number; startY: number; t: number } | null>(null);
  const [aimAngle, setAimAngle] = useState<number | null>(null);
  const [aimPower, setAimPower] = useState(0);
  const [showAim, setShowAim] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);

  const px = (nx: number) => nx * AREA;
  const py = (ny: number) => ny * AREA;

  function getAreaPos(clientX: number, clientY: number) {
    const rect = areaRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / AREA,
      y: (clientY - rect.top)  / AREA,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!canShoot || !areaRef.current) return;
    aimRef.current = { startX: e.clientX, startY: e.clientY, t: Date.now() };
    setShowAim(true);
    setAimPower(0);
    setAimAngle(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!aimRef.current) return;
    const dx = e.clientX - aimRef.current.startX;
    const dy = e.clientY - aimRef.current.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 5) {
      // Aim direction is OPPOSITE to drag direction (like a slingshot)
      setAimAngle(Math.atan2(-dy, -dx));
      const holdElapsed = Date.now() - aimRef.current.t;
      setAimPower(Math.min(1, Math.sqrt(dist / 80)));
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!aimRef.current) return;
    const dx = e.clientX - aimRef.current.startX;
    const dy = e.clientY - aimRef.current.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    aimRef.current = null;
    setShowAim(false);
    setAimAngle(null);
    setAimPower(0);

    if (!canShoot || dist < 5) return;

    const angle = Math.atan2(-dy, -dx);
    const power = Math.min(1, Math.sqrt(dist / 80));
    onInput({ angle, power });
  }

  // Aim arrow display
  const ballPx = px(course.ballStart.x);
  const ballPy = py(course.ballStart.y);
  const ARROW_LEN = 55;

  return (
    <div className="flex flex-col items-center gap-3 py-2 w-full select-none" dir="ltr">
      {/* Header */}
      <div className="flex justify-between w-full items-center px-2">
        <span className="text-sm font-semibold text-(--accent)">{course.name}</span>
        <Chip size="sm" color="default" variant="secondary">{Math.ceil(remainingMs / 1000)}s</Chip>
      </div>

      {/* Result chips */}
      <div className="flex gap-3 w-full px-2">
        <div className="flex flex-col items-center flex-1">
          <span className="text-xs text-(--muted)">You</span>
          {myShot ? (
            <Chip size="sm" color={myShot.distToHole === 0 ? "success" : "default"} variant="soft">
              {myShot.distToHole === 0 ? "Hole-in-one!" : `${(myShot.distToHole * 100).toFixed(0)}cm`}
            </Chip>
          ) : (
            <span className="text-xs text-(--muted)">{canShoot ? "Drag to aim" : "Waiting…"}</span>
          )}
        </div>
        <div className="flex flex-col items-center flex-1">
          <span className="text-xs text-(--muted)">Opponent</span>
          {oppShot ? (
            <Chip size="sm" color={oppShot.distToHole === 0 ? "success" : "default"} variant="soft">
              {oppShot.distToHole === 0 ? "Hole-in-one!" : `${(oppShot.distToHole * 100).toFixed(0)}cm`}
            </Chip>
          ) : (
            <span className="text-xs text-(--muted)">—</span>
          )}
        </div>
      </div>

      {/* Course area */}
      <div
        ref={areaRef}
        className="relative bg-green-900 rounded-2xl overflow-hidden border-2 border-green-700 touch-none"
        style={{ width: AREA, height: AREA, cursor: canShoot ? "crosshair" : "default" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Fairway / green background markings */}
        <div className="absolute inset-2 rounded-xl bg-green-800 opacity-60" />

        {/* Walls */}
        {course.walls.map((wall, i) => (
          <div
            key={i}
            className="absolute bg-amber-900 border border-amber-700 rounded-sm"
            style={{
              left: px(wall.x),
              top:  py(wall.y),
              width:  wall.w * AREA,
              height: wall.h * AREA,
            }}
          />
        ))}

        {/* Hole */}
        <div
          className="absolute rounded-full bg-black border-2 border-gray-400"
          style={{
            width: 20, height: 20,
            left: px(course.hole.x) - 10,
            top:  py(course.hole.y) - 10,
          }}
        />
        {/* Hole flag */}
        <div
          className="absolute pointer-events-none"
          style={{ left: px(course.hole.x) + 10, top: py(course.hole.y) - 28 }}
        >
          <div className="w-0.5 h-7 bg-gray-300" />
          <div className="absolute top-0 left-0.5 w-4 h-3 bg-red-500" />
        </div>

        {/* Opponent final position */}
        {oppShot && (
          <div
            className="absolute rounded-full border-2 pointer-events-none"
            style={{
              width: 14, height: 14,
              left: px(oppShot.finalX) - 7,
              top:  py(oppShot.finalY) - 7,
              background: "#3b82f6",
              borderColor: "#1d4ed8",
              opacity: 0.7,
            }}
          />
        )}

        {/* My ball / final position */}
        {myShot ? (
          <div
            className="absolute rounded-full border-2 pointer-events-none shadow-lg"
            style={{
              width: 16, height: 16,
              left: px(myShot.finalX) - 8,
              top:  py(myShot.finalY) - 8,
              background: "white",
              borderColor: "#374151",
            }}
          />
        ) : (
          <>
            {/* Ball at start */}
            <div
              className="absolute rounded-full border-2 shadow-md"
              style={{
                width: 16, height: 16,
                left: ballPx - 8,
                top:  ballPy - 8,
                background: "white",
                borderColor: "#374151",
              }}
            />
            {/* Aim arrow */}
            {showAim && aimAngle !== null && (
              <svg
                className="absolute top-0 left-0 pointer-events-none"
                width={AREA} height={AREA}
              >
                <defs>
                  <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="rgba(255,255,255,0.85)" />
                  </marker>
                </defs>
                <line
                  x1={ballPx}
                  y1={ballPy}
                  x2={ballPx + Math.cos(aimAngle) * ARROW_LEN * aimPower}
                  y2={ballPy + Math.sin(aimAngle) * ARROW_LEN * aimPower}
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth="2.5"
                  markerEnd="url(#arrowhead)"
                />
              </svg>
            )}
          </>
        )}

        {s.done && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
            <span className="text-white text-xl font-bold">Round over!</span>
          </div>
        )}
      </div>

      {/* Power bar while aiming */}
      {showAim && (
        <div className="w-full max-w-[300px] flex flex-col gap-1">
          <div className="flex justify-between text-xs text-(--muted)">
            <span>Power</span>
            <span>{Math.round(aimPower * 100)}%</span>
          </div>
          <div className="w-full bg-(--surface-secondary) rounded-full h-3">
            <div
              className="h-3 rounded-full transition-none"
              style={{ width: `${aimPower * 100}%`, background: `hsl(${120 - aimPower * 120}, 70%, 45%)` }}
            />
          </div>
        </div>
      )}

      {!showAim && canShoot && (
        <p className="text-xs text-(--muted)">Drag from the ball to aim and set power</p>
      )}

      {/* Legend */}
      <div className="flex gap-3 text-xs text-(--muted)">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-white border border-gray-400" /> You</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-blue-400 border border-blue-600 opacity-70" /> Opponent</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-black border border-gray-400" /> Hole</span>
      </div>
    </div>
  );
}
