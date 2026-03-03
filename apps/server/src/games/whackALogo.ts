import { GameDefinition } from "@arena/shared";

// ── Grid layout constants ─────────────────────────────────────────────────────
// We divide the play area into a fixed grid of COLS×ROWS slots.
// Each slot has a deterministic center; logos/bombs are always placed in a slot.
// This prevents any position changes when a bomb despawns.

const LOGO_SIZE = 80;
const AREA_W = 320;
const AREA_H = 340;
const COLS = 3;
const ROWS = 3;
const TOTAL_SLOTS = COLS * ROWS; // 9 slots

const MAX_LOGOS = 2;   // logos on the field at once per player
const MAX_BOMBS = 4;   // max bomb appearances per player per match
const BOMB_CHANCE = 1 / 6;
const BOMB_LIFETIME_MS = 2500;

/** Pre-computed slot top-left positions (same formula on client). */
function slotPosition(slotIdx: number): { x: number; y: number } {
  const col = slotIdx % COLS;
  const row = Math.floor(slotIdx / COLS);
  const cellW = (AREA_W - LOGO_SIZE) / (COLS - 1);
  const cellH = (AREA_H - LOGO_SIZE) / (ROWS - 1);
  return {
    x: Math.round(col * cellW),
    y: Math.round(row * cellH),
  };
}

interface Target {
  id: string;
  slotIdx: number; // which grid slot this target occupies
  x: number;
  y: number;
  isBomb: boolean;
  spawnedAt: number; // epoch ms — used to expire bombs
}

interface PlayerSlot {
  targets: Target[];
  bombsShown: number;
}

interface State {
  playerIds: string[];
  slots: Record<string, PlayerSlot>;
  hits: Record<string, number>;
  idCounter: number; // deterministic incrementing ID counter
}

interface PublicTarget {
  id: string;
  x: number;
  y: number;
  isBomb: boolean;
}

interface Public {
  slots: Record<string, { targets: PublicTarget[] }>;
  hits: Record<string, number>;
}

function makeId(counter: number): string {
  return `t${counter}`;
}

/** Pick `count` random distinct slot indices from the full set, avoiding `occupied`. */
function pickFreeSlots(occupied: Set<number>, count: number): number[] {
  const free: number[] = [];
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    if (!occupied.has(i)) free.push(i);
  }
  // Fisher-Yates shuffle on free
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  return free.slice(0, count);
}

function initSlot(idCounter: number): { playerSlot: PlayerSlot; nextCounter: number } {
  const freeSlots = pickFreeSlots(new Set<number>(), MAX_LOGOS);
  const targets: Target[] = [];
  let ctr = idCounter;
  const now = Date.now();
  for (const si of freeSlots) {
    const pos = slotPosition(si);
    targets.push({ id: makeId(ctr++), slotIdx: si, x: pos.x, y: pos.y, isBomb: false, spawnedAt: now });
  }
  return { playerSlot: { targets, bombsShown: 0 }, nextCounter: ctr };
}

/**
 * After a logo is tapped: spawn a replacement logo in a free slot.
 * Optionally also spawn a bomb if conditions are met.
 * `remaining` is the target list AFTER the tapped logo was removed.
 */
function spawnAfterTap(
  remaining: Target[],
  bombsShown: number,
  idCounter: number,
): { playerSlot: PlayerSlot; nextCounter: number } {
  const now = Date.now();
  const occupied = new Set(remaining.map((t) => t.slotIdx));
  const hasBomb = remaining.some((t) => t.isBomb);
  const canShowBomb = !hasBomb && bombsShown < MAX_BOMBS;
  const showBomb = canShowBomb && Math.random() < BOMB_CHANCE;
  let ctr = idCounter;

  const neededSlots = showBomb ? 2 : 1;
  const freeSlots = pickFreeSlots(occupied, neededSlots);

  const newTargets = [...remaining];
  if (freeSlots.length >= 1) {
    const pos = slotPosition(freeSlots[0]);
    newTargets.push({ id: makeId(ctr++), slotIdx: freeSlots[0], x: pos.x, y: pos.y, isBomb: false, spawnedAt: now });
  }
  const bombActuallySpawned = showBomb && freeSlots.length >= 2;
  if (bombActuallySpawned) {
    const pos = slotPosition(freeSlots[1]);
    newTargets.push({ id: makeId(ctr++), slotIdx: freeSlots[1], x: pos.x, y: pos.y, isBomb: true, spawnedAt: now });
  }

  return {
    playerSlot: { targets: newTargets, bombsShown: bombsShown + (bombActuallySpawned ? 1 : 0) },
    nextCounter: ctr,
  };
}

/**
 * Expire any bomb whose BOMB_LIFETIME_MS has elapsed.
 * IMPORTANT: When a bomb expires, we ONLY remove it — we do NOT spawn a replacement.
 * This ensures existing logo positions never change on bomb despawn.
 */
export function expireBombs(slot: PlayerSlot): { slot: PlayerSlot; expired: boolean } {
  const now = Date.now();
  const liveBomb = slot.targets.find((t) => t.isBomb);
  if (!liveBomb || now - liveBomb.spawnedAt < BOMB_LIFETIME_MS) {
    return { slot, expired: false };
  }
  // Bomb has expired — just remove it, no replacement (logo positions stay stable)
  const withoutBomb = slot.targets.filter((t) => !t.isBomb);
  return {
    slot: { ...slot, targets: withoutBomb },
    expired: true,
  };
}

/** Return the time until the current bomb expires, or null if no bomb. */
export function bombExpiresIn(slot: PlayerSlot): number | null {
  const bomb = slot.targets.find((t) => t.isBomb);
  if (!bomb) return null;
  const remaining = BOMB_LIFETIME_MS - (Date.now() - bomb.spawnedAt);
  return remaining > 0 ? remaining : 0;
}

const whackALogo: GameDefinition<State, Public> = {
  id: "whack_a_logo",
  displayName: { en: "Whack a Logo", ar: "اضرب الشعار" },
  durationMs: 15000,
  instructions: {
    en: "Tap the logo (+1 pt) as fast as you can! A 💣 bomb may appear — tap it for −2 pts. Most points wins.",
    ar: "انقر على الشعار (+1 نقطة) بأسرع ما يمكن! قد تظهر 💣 قنبلة — انقرها مقابل −2 نقطة. الأكثر نقاطاً يفوز.",
  },
  init(playerIds) {
    const slots: Record<string, PlayerSlot> = {};
    let counter = 0;
    for (const id of playerIds) {
      const { playerSlot, nextCounter } = initSlot(counter);
      slots[id] = playerSlot;
      counter = nextCounter;
    }
    return {
      playerIds,
      slots,
      hits: Object.fromEntries(playerIds.map((id) => [id, 0])),
      idCounter: counter,
    };
  },
  publicState(s) {
    return {
      slots: Object.fromEntries(
        s.playerIds.map((id) => {
          const { slot } = expireBombs(s.slots[id]);
          return [id, {
            targets: slot.targets.map(({ id: tid, x, y, isBomb }) => ({ id: tid, x, y, isBomb })),
          }];
        })
      ),
      hits: s.hits,
    };
  },
  input(s, playerId, payload) {
    const { targetId } = payload as { targetId: string };
    const slot = s.slots[playerId];
    if (!slot) return s;

    // Expire bombs before processing the tap
    const { slot: freshSlot } = expireBombs(slot);

    const tIdx = freshSlot.targets.findIndex((t) => t.id === targetId);
    if (tIdx === -1) {
      // Stale tap — apply expiry only, no position changes
      return { ...s, slots: { ...s.slots, [playerId]: freshSlot } };
    }

    const tapped = freshSlot.targets[tIdx];
    const remaining = freshSlot.targets.filter((_, i) => i !== tIdx);

    if (tapped.isBomb) {
      // Bomb tapped: −2 pts, remove bomb only (no replacement spawned here)
      return {
        ...s,
        hits: { ...s.hits, [playerId]: (s.hits[playerId] ?? 0) - 2 },
        slots: { ...s.slots, [playerId]: { ...freshSlot, targets: remaining } },
      };
    }

    // Logo tapped: +1 pt, spawn replacement in a free slot
    const { playerSlot: newSlot, nextCounter } = spawnAfterTap(
      remaining,
      freshSlot.bombsShown,
      s.idCounter,
    );
    return {
      ...s,
      hits: { ...s.hits, [playerId]: (s.hits[playerId] ?? 0) + 1 },
      slots: { ...s.slots, [playerId]: newSlot },
      idCounter: nextCounter,
    };
  },
  resolve(s) {
    const sorted = [...s.playerIds].sort((a, b) => (s.hits[b] ?? 0) - (s.hits[a] ?? 0));
    const topHits = s.hits[sorted[0]] ?? 0;
    const winners = sorted.filter((id) => (s.hits[id] ?? 0) === topHits);
    const outcomeByPlayerId: Record<string, number> = {};
    for (const id of s.playerIds) {
      outcomeByPlayerId[id] = winners.includes(id) ? (winners.length > 1 ? 0.5 : 1) : 0;
    }
    const bombsShown = Object.fromEntries(s.playerIds.map((id) => [id, s.slots[id].bombsShown]));
    return { outcomeByPlayerId, stats: { hits: s.hits, bombsShown } };
  },
};

export default whackALogo;
