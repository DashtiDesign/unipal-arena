import { GameDefinition } from "@arena/shared";

// ── Constants ─────────────────────────────────────────────────────────────────

const DURATION_MS = 20_000;

// Physics — server-side deterministic simulation
// Coordinate system: origin top-left, x right, y down
// The bin is at a fixed position; ball is launched from a fixed launch point.
const LAUNCH_X = 0.5;  // normalized [0,1] — center of play area
const LAUNCH_Y = 0.85; // near bottom
const BIN_X    = 0.5;  // center
const BIN_Y    = 0.2;  // upper area
const BIN_RADIUS = 0.07; // normalized radius for hit detection

// Gravity and wind are in normalized units/s²
const GRAVITY = 1.2; // downward

// Wind: generated per duel, constant for both players
// Range: [-0.6, 0.6] in x and [-0.15, 0.15] in y
const WIND_X_RANGE = 0.6;
const WIND_Y_RANGE = 0.15;

// Input clamps
const MAX_SPEED = 3.5;   // normalized units/s
const MIN_SPEED = 0.3;
const SIM_STEPS = 200;   // integration steps
const SIM_DT    = 0.015; // seconds per step (200 × 0.015 = 3s of flight time max)

// ── Types ─────────────────────────────────────────────────────────────────────

interface Wind { wx: number; wy: number }

interface ThrowResult {
  scored: boolean;
  // Final ball position (for display)
  landX: number;
  landY: number;
}

interface State {
  playerIds: string[];
  wind: Wind;
  scores: Record<string, number>;      // total baskets made
  throws: Record<string, number>;      // total throws attempted
  results: Record<string, ThrowResult[]>; // per-player throw history
  done: Record<string, boolean>;        // true once time has expired (resolved server-side)
}

interface Public {
  wind: Wind;
  scores: Record<string, number>;
  throws: Record<string, number>;
  // Only the latest throw result per player (to show feedback, not full history)
  lastThrow: Record<string, ThrowResult | null>;
  done: boolean;
}

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

// ── Physics simulation ────────────────────────────────────────────────────────

/**
 * Simulate a paper throw with given initial velocity.
 * Returns whether the ball lands in the bin and the final position.
 */
function simulateThrow(
  vx: number, vy: number, wind: Wind,
): { scored: boolean; landX: number; landY: number } {
  let x = LAUNCH_X;
  let y = LAUNCH_Y;
  let vxCur = vx;
  let vyCur = vy; // negative = upward

  for (let i = 0; i < SIM_STEPS; i++) {
    // Wind accelerates the ball (constant over time)
    vxCur += wind.wx * SIM_DT;
    vyCur += wind.wy * SIM_DT;
    // Gravity pulls down
    vyCur += GRAVITY * SIM_DT;

    x += vxCur * SIM_DT;
    y += vyCur * SIM_DT;

    // Check if ball passed through the bin zone (y crosses BIN_Y from above)
    if (y >= BIN_Y - 0.05 && y <= BIN_Y + 0.05) {
      const dx = x - BIN_X;
      const dy = y - BIN_Y;
      if (dx * dx + dy * dy <= BIN_RADIUS * BIN_RADIUS) {
        return { scored: true, landX: x, landY: y };
      }
    }

    // Stop if ball goes out of bounds or hits ground
    if (y > 1.05 || x < -0.2 || x > 1.2) {
      break;
    }
  }

  return { scored: false, landX: Math.max(0, Math.min(1, x)), landY: Math.max(0, Math.min(1, y)) };
}

// ── Game Definition ───────────────────────────────────────────────────────────

const paperToss: GameDefinition<State, Public> = {
  id: "paper_toss",
  displayName: { en: "Paper Toss", ar: "رمي الورق" },
  durationMs: DURATION_MS,
  instructions: {
    en: "Flick paper into the bin! Wind affects your throw — watch the arrow. Most baskets in 20s wins.",
    ar: "ارمِ الورقة في السلة! الريح تؤثر على رميتك — راقب السهم. أكثر رميات ناجحة في 20 ثانية يفوز.",
  },
  init(playerIds) {
    // Generate deterministic wind for this duel
    const seed = Math.floor(Math.random() * 0xFFFFFFFF);
    const rng = mulberry32(seed);
    const wx = (rng() * 2 - 1) * WIND_X_RANGE;
    const wy = (rng() * 2 - 1) * WIND_Y_RANGE;

    return {
      playerIds,
      wind: { wx, wy },
      scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
      throws: Object.fromEntries(playerIds.map((id) => [id, 0])),
      results: Object.fromEntries(playerIds.map((id) => [id, []])),
      done: Object.fromEntries(playerIds.map((id) => [id, false])),
    };
  },
  publicState(s) {
    const lastThrow: Record<string, ThrowResult | null> = {};
    for (const id of s.playerIds) {
      const hist = s.results[id];
      lastThrow[id] = hist && hist.length > 0 ? hist[hist.length - 1] : null;
    }
    const anyDone = s.playerIds.some((id) => s.done[id]);
    return {
      wind: s.wind,
      scores: s.scores,
      throws: s.throws,
      lastThrow,
      done: anyDone,
    };
  },
  input(s, playerId, payload) {
    if (s.done[playerId]) return s;

    // Client sends: { vx, vy } — normalized velocity components
    const p = payload as { vx?: number; vy?: number };
    if (typeof p.vx !== "number" || typeof p.vy !== "number") return s;

    // Clamp input speed
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    let vx = p.vx;
    let vy = p.vy;
    if (speed > MAX_SPEED) {
      vx = (vx / speed) * MAX_SPEED;
      vy = (vy / speed) * MAX_SPEED;
    }
    if (speed < MIN_SPEED && speed > 0) {
      vx = (vx / speed) * MIN_SPEED;
      vy = (vy / speed) * MIN_SPEED;
    }

    const result = simulateThrow(vx, vy, s.wind);
    const newResults = [...s.results[playerId], result];

    return {
      ...s,
      scores: { ...s.scores, [playerId]: s.scores[playerId] + (result.scored ? 1 : 0) },
      throws: { ...s.throws, [playerId]: s.throws[playerId] + 1 },
      results: { ...s.results, [playerId]: newResults },
    };
  },
  resolve(s) {
    const [a, b] = s.playerIds;
    const sA = s.scores[a] ?? 0;
    const sB = s.scores[b] ?? 0;
    const outcomeByPlayerId: Record<string, number> = {};
    if (sA === sB) {
      outcomeByPlayerId[a] = 0.5;
      outcomeByPlayerId[b] = 0.5;
    } else if (sA > sB) {
      outcomeByPlayerId[a] = 1;
      outcomeByPlayerId[b] = 0;
    } else {
      outcomeByPlayerId[a] = 0;
      outcomeByPlayerId[b] = 1;
    }
    return {
      outcomeByPlayerId,
      stats: {
        scores: s.scores,
        throws: s.throws,
        wind: s.wind,
      },
    };
  },
};

export default paperToss;
