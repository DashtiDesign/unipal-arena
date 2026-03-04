import { GameDefinition } from "@arena/shared";

// ── Constants ─────────────────────────────────────────────────────────────────

const DURATION_MS = 20_000;
const BALL_RADIUS = 0.025; // normalized
const HOLE_RADIUS = 0.04;
const FRICTION    = 0.985; // velocity multiplier per physics step
const SIM_STEPS   = 600;   // max integration steps
const SIM_DT      = 0.02;  // seconds per step (600 × 0.02 = 12s simulation)
const MAX_POWER   = 0.6;   // max initial speed (normalized units/s)
const MIN_POWER   = 0.05;

// ── Course Definitions ────────────────────────────────────────────────────────

interface Rect { x: number; y: number; w: number; h: number }
interface Course {
  id: number;
  name: string;
  ballStart: { x: number; y: number };
  hole: { x: number; y: number };
  walls: Rect[];  // axis-aligned rectangles (obstacle walls)
}

// All coordinates are normalized [0,1] in a square play area
// Walls are AABB obstacles (not boundary walls — those are implicit at 0,1)
const COURSES: Course[] = [
  {
    id: 0,
    name: "Straight Shot",
    ballStart: { x: 0.5, y: 0.85 },
    hole: { x: 0.5, y: 0.15 },
    walls: [
      { x: 0.1, y: 0.40, w: 0.25, h: 0.06 },
      { x: 0.65, y: 0.40, w: 0.25, h: 0.06 },
    ],
  },
  {
    id: 1,
    name: "Dog Leg Right",
    ballStart: { x: 0.15, y: 0.8 },
    hole: { x: 0.8, y: 0.2 },
    walls: [
      { x: 0.35, y: 0.55, w: 0.06, h: 0.35 },
      { x: 0.35, y: 0.55, w: 0.35, h: 0.06 },
    ],
  },
  {
    id: 2,
    name: "Corridor",
    ballStart: { x: 0.5, y: 0.85 },
    hole: { x: 0.5, y: 0.15 },
    walls: [
      { x: 0.1,  y: 0.1,  w: 0.28, h: 0.8 },
      { x: 0.62, y: 0.1,  w: 0.28, h: 0.8 },
    ],
  },
  {
    id: 3,
    name: "Island Green",
    ballStart: { x: 0.5, y: 0.85 },
    hole: { x: 0.5, y: 0.2 },
    walls: [
      { x: 0.05, y: 0.45, w: 0.35, h: 0.10 },
      { x: 0.60, y: 0.45, w: 0.35, h: 0.10 },
      { x: 0.20, y: 0.25, w: 0.60, h: 0.06 },
    ],
  },
  {
    id: 4,
    name: "Zigzag",
    ballStart: { x: 0.1, y: 0.85 },
    hole: { x: 0.9, y: 0.15 },
    walls: [
      { x: 0.30, y: 0.30, w: 0.06, h: 0.50 },
      { x: 0.60, y: 0.20, w: 0.06, h: 0.50 },
    ],
  },
  {
    id: 5,
    name: "Windmill Alley",
    ballStart: { x: 0.5, y: 0.88 },
    hole: { x: 0.5, y: 0.12 },
    walls: [
      { x: 0.15, y: 0.55, w: 0.30, h: 0.06 },
      { x: 0.55, y: 0.55, w: 0.30, h: 0.06 },
      { x: 0.15, y: 0.30, w: 0.30, h: 0.06 },
      { x: 0.55, y: 0.30, w: 0.30, h: 0.06 },
    ],
  },
  {
    id: 6,
    name: "The Bounce",
    ballStart: { x: 0.1, y: 0.5 },
    hole: { x: 0.9, y: 0.5 },
    walls: [
      { x: 0.30, y: 0.10, w: 0.06, h: 0.55 },
      { x: 0.64, y: 0.35, w: 0.06, h: 0.55 },
    ],
  },
  {
    id: 7,
    name: "Corner Pocket",
    ballStart: { x: 0.15, y: 0.82 },
    hole: { x: 0.82, y: 0.15 },
    walls: [
      { x: 0.38, y: 0.38, w: 0.24, h: 0.24 },
      { x: 0.05, y: 0.05, w: 0.20, h: 0.06 },
      { x: 0.75, y: 0.75, w: 0.20, h: 0.06 },
    ],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Shot {
  angle: number;  // radians, 0 = right
  power: number;  // normalized [0,1]
  finalX: number;
  finalY: number;
  distToHole: number;
}

interface State {
  playerIds: string[];
  courseId: number;
  shots: Record<string, Shot | null>;  // null until player shoots
}

interface Public {
  courseId: number;
  shots: Record<string, Shot | null>;
  done: boolean;
}

// ── Seeded PRNG ───────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

// ── AABB collision helper ─────────────────────────────────────────────────────

/**
 * Resolve a moving ball against an axis-aligned wall rectangle.
 * Returns the updated velocity after bounce (if collision occurred).
 */
function resolveWall(
  bx: number, by: number,
  vx: number, vy: number,
  wall: Rect,
): { vx: number; vy: number } {
  // Expand wall by ball radius for center-point collision
  const left   = wall.x - BALL_RADIUS;
  const right  = wall.x + wall.w + BALL_RADIUS;
  const top    = wall.y - BALL_RADIUS;
  const bottom = wall.y + wall.h + BALL_RADIUS;

  if (bx < left || bx > right || by < top || by > bottom) return { vx, vy };

  // Find closest edge and reflect
  const dLeft   = bx - left;
  const dRight  = right - bx;
  const dTop    = by - top;
  const dBottom = bottom - by;
  const minD = Math.min(dLeft, dRight, dTop, dBottom);

  if (minD === dLeft || minD === dRight) return { vx: -vx * 0.75, vy: vy * 0.75 };
  return { vx: vx * 0.75, vy: -vy * 0.75 };
}

// ── Physics simulation ────────────────────────────────────────────────────────

function simulateShot(
  course: Course, angle: number, speed: number,
): { finalX: number; finalY: number; distToHole: number } {
  let bx = course.ballStart.x;
  let by = course.ballStart.y;
  let vx = Math.cos(angle) * speed;
  let vy = Math.sin(angle) * speed;

  for (let i = 0; i < SIM_STEPS; i++) {
    bx += vx * SIM_DT;
    by += vy * SIM_DT;

    // Boundary bounces
    if (bx < BALL_RADIUS) { bx = BALL_RADIUS; vx = Math.abs(vx) * 0.75; }
    if (bx > 1 - BALL_RADIUS) { bx = 1 - BALL_RADIUS; vx = -Math.abs(vx) * 0.75; }
    if (by < BALL_RADIUS) { by = BALL_RADIUS; vy = Math.abs(vy) * 0.75; }
    if (by > 1 - BALL_RADIUS) { by = 1 - BALL_RADIUS; vy = -Math.abs(vy) * 0.75; }

    // Wall bounces
    for (const wall of course.walls) {
      const res = resolveWall(bx, by, vx, vy, wall);
      vx = res.vx;
      vy = res.vy;
    }

    // Check if ball enters hole
    const hdx = bx - course.hole.x;
    const hdy = by - course.hole.y;
    const holeDist = Math.sqrt(hdx * hdx + hdy * hdy);
    if (holeDist < HOLE_RADIUS) {
      return { finalX: course.hole.x, finalY: course.hole.y, distToHole: 0 };
    }

    // Apply friction
    vx *= FRICTION;
    vy *= FRICTION;

    // Stop if nearly stationary
    if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001) break;
  }

  const dx = bx - course.hole.x;
  const dy = by - course.hole.y;
  return {
    finalX: bx,
    finalY: by,
    distToHole: Math.sqrt(dx * dx + dy * dy),
  };
}

// ── Game Definition ───────────────────────────────────────────────────────────

const miniGolf: GameDefinition<State, Public> = {
  id: "mini_golf",
  displayName: { en: "Mini Golf", ar: "غولف مصغر" },
  durationMs: DURATION_MS,
  instructions: {
    en: "Aim and set power — then shoot! One shot each. Closest to the hole wins.",
    ar: "صوّب واضبط القوة — ثم اضرب! رمية واحدة لكل لاعب. الأقرب للحفرة يفوز.",
  },
  init(playerIds) {
    // Seeded course selection — deterministic per duel
    const seed = Math.floor(Math.random() * 0xFFFFFFFF);
    const rng = mulberry32(seed);
    const courseId = Math.floor(rng() * COURSES.length);
    return {
      playerIds,
      courseId,
      shots: Object.fromEntries(playerIds.map((id) => [id, null])),
    };
  },
  publicState(s) {
    const allShot = s.playerIds.every((id) => s.shots[id] !== null);
    return {
      courseId: s.courseId,
      shots: s.shots,
      done: allShot,
    };
  },
  input(s, playerId, payload) {
    if (s.shots[playerId] !== null) return s; // already shot

    const p = payload as { angle?: number; power?: number };
    if (typeof p.angle !== "number" || typeof p.power !== "number") return s;

    // Clamp power
    const power = Math.max(0, Math.min(1, p.power));
    const angle = p.angle; // radians, free direction
    const speed = MIN_POWER + power * (MAX_POWER - MIN_POWER);

    const course = COURSES[s.courseId];
    const { finalX, finalY, distToHole } = simulateShot(course, angle, speed);

    const shot: Shot = { angle, power, finalX, finalY, distToHole };
    return { ...s, shots: { ...s.shots, [playerId]: shot } };
  },
  resolve(s) {
    const [a, b] = s.playerIds;
    const shotA = s.shots[a];
    const shotB = s.shots[b];

    // If neither shot — draw
    const dA = shotA?.distToHole ?? Infinity;
    const dB = shotB?.distToHole ?? Infinity;

    const outcomeByPlayerId: Record<string, number> = {};
    if (dA === dB) {
      outcomeByPlayerId[a] = 0.5;
      outcomeByPlayerId[b] = 0.5;
    } else if (dA < dB) {
      outcomeByPlayerId[a] = 1;
      outcomeByPlayerId[b] = 0;
    } else {
      outcomeByPlayerId[a] = 0;
      outcomeByPlayerId[b] = 1;
    }

    return {
      outcomeByPlayerId,
      stats: {
        courseId: s.courseId,
        courseName: COURSES[s.courseId]?.name ?? "",
        shots: s.shots,
      },
    };
  },
  isResolved(s) {
    return s.playerIds.every((id) => s.shots[id] !== null);
  },
};

export default miniGolf;
export { COURSES };
