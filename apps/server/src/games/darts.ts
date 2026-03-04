import { GameDefinition } from "@arena/shared";

// ── Constants ─────────────────────────────────────────────────────────────────

const DURATION_MS = 20_000;
const MAX_THROWS = 3;

// Scoring rings — distance from center [0..1] → score
// 0.00–0.08 = bullseye (50)
// 0.08–0.20 = inner bull (25)
// 0.20–0.45 = triple ring segments (score 3× segment value)
// 0.45–0.65 = double ring (2× segment value)
// 0.65–1.00 = single ring (segment value)
// > 1.00    = miss (0)
// For simplicity we use 5 concentric zones with fixed scores:
const ZONES: { maxR: number; score: number; label: string }[] = [
  { maxR: 0.07, score: 50,  label: "Bullseye" },
  { maxR: 0.17, score: 25,  label: "Bull" },
  { maxR: 0.42, score: 10,  label: "Inner" },
  { maxR: 0.72, score: 5,   label: "Outer" },
  { maxR: 1.00, score: 2,   label: "Edge" },
];
// Miss = 0 points

// Maximum wobble radius added by server (normalized)
const MAX_WOBBLE = 0.12;

// Power affects wobble: hold longer → less wobble. [0..1] normalized.
const MAX_HOLD_MS = 1500; // full hold = full power = minimum wobble

// ── Types ─────────────────────────────────────────────────────────────────────

interface DartThrow {
  aimX: number;   // normalized [0,1] aim position on board
  aimY: number;
  landX: number;  // actual landing after wobble
  landY: number;
  score: number;
  zone: string;
}

interface State {
  playerIds: string[];
  seed: number;
  throwCount: Record<string, number>;
  throws: Record<string, DartThrow[]>;
  totals: Record<string, number>;
}

interface Public {
  throwCount: Record<string, number>;
  throws: Record<string, DartThrow[]>;
  totals: Record<string, number>;
  maxThrows: number;
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

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreZone(dx: number, dy: number): { score: number; zone: string } {
  const r = Math.sqrt(dx * dx + dy * dy);
  for (const zone of ZONES) {
    if (r <= zone.maxR) return { score: zone.score, zone: zone.label };
  }
  return { score: 0, zone: "Miss" };
}

// ── Game Definition ───────────────────────────────────────────────────────────

const darts: GameDefinition<State, Public> = {
  id: "darts",
  displayName: { en: "Darts", ar: "رمي السهام" },
  durationMs: DURATION_MS,
  instructions: {
    en: "Aim and hold to power up — release to throw! 3 darts each. Highest total score wins.",
    ar: "صوّب واضغط باستمرار لشحن القوة — ثم أطلق! 3 سهام لكل لاعب. أعلى مجموع نقاط يفوز.",
  },
  init(playerIds) {
    return {
      playerIds,
      seed: Math.floor(Math.random() * 0xFFFFFFFF),
      throwCount: Object.fromEntries(playerIds.map((id) => [id, 0])),
      throws: Object.fromEntries(playerIds.map((id) => [id, []])),
      totals: Object.fromEntries(playerIds.map((id) => [id, 0])),
    };
  },
  publicState(s) {
    const allDone = s.playerIds.every((id) => s.throwCount[id] >= MAX_THROWS);
    return {
      throwCount: s.throwCount,
      throws: s.throws,
      totals: s.totals,
      maxThrows: MAX_THROWS,
      done: allDone,
    };
  },
  input(s, playerId, payload) {
    if ((s.throwCount[playerId] ?? 0) >= MAX_THROWS) return s;

    const p = payload as { aimX?: number; aimY?: number; holdMs?: number };
    if (typeof p.aimX !== "number" || typeof p.aimY !== "number") return s;

    // Clamp aim to board
    const aimX = Math.max(0, Math.min(1, p.aimX));
    const aimY = Math.max(0, Math.min(1, p.aimY));

    // Power from hold duration: 0 = no hold (max wobble), 1 = full hold (min wobble)
    const holdMs = typeof p.holdMs === "number" ? Math.max(0, Math.min(MAX_HOLD_MS, p.holdMs)) : 0;
    const power = holdMs / MAX_HOLD_MS;
    const wobbleRadius = MAX_WOBBLE * (1 - power * 0.75); // min wobble at full power = 25% of max

    // Deterministic wobble from seed + throw index
    const throwIdx = s.throwCount[playerId] ?? 0;
    const rng = mulberry32(s.seed ^ (playerId.charCodeAt(0) * 1000 + throwIdx * 17));
    const angle = rng() * Math.PI * 2;
    const r = rng() * wobbleRadius;
    const wobbleX = Math.cos(angle) * r;
    const wobbleY = Math.sin(angle) * r;

    // Landing position: center of board is (0.5, 0.5)
    // Convert aim to offset from center
    const dx = (aimX - 0.5) + wobbleX;
    const dy = (aimY - 0.5) + wobbleY;
    const landX = Math.max(0, Math.min(1, 0.5 + dx));
    const landY = Math.max(0, Math.min(1, 0.5 + dy));

    const { score, zone } = scoreZone(dx, dy);

    const dartThrow: DartThrow = { aimX, aimY, landX, landY, score, zone };
    const newThrows = [...(s.throws[playerId] ?? []), dartThrow];
    const newCount = throwIdx + 1;
    const newTotal = (s.totals[playerId] ?? 0) + score;

    return {
      ...s,
      throwCount: { ...s.throwCount, [playerId]: newCount },
      throws: { ...s.throws, [playerId]: newThrows },
      totals: { ...s.totals, [playerId]: newTotal },
    };
  },
  resolve(s) {
    const [a, b] = s.playerIds;
    const tA = s.totals[a] ?? 0;
    const tB = s.totals[b] ?? 0;
    const outcomeByPlayerId: Record<string, number> = {};
    if (tA === tB) {
      outcomeByPlayerId[a] = 0.5;
      outcomeByPlayerId[b] = 0.5;
    } else if (tA > tB) {
      outcomeByPlayerId[a] = 1;
      outcomeByPlayerId[b] = 0;
    } else {
      outcomeByPlayerId[a] = 0;
      outcomeByPlayerId[b] = 1;
    }
    return {
      outcomeByPlayerId,
      stats: {
        totals: s.totals,
        throws: s.throws,
      },
    };
  },
  isResolved(s) {
    return s.playerIds.every((id) => (s.throwCount[id] ?? 0) >= MAX_THROWS);
  },
};

export default darts;
