import { GameDefinition } from "@arena/shared";

const LOGO_SIZE = 80; // px — matches client logo size
const AREA_W = 320;   // safe play area width (client uses same constant)
const AREA_H = 340;   // safe play area height
const MAX_LOGOS = 3;  // max simultaneous logos per player
const MAX_BOMBS = 3;  // max bomb appearances per player per match
const BOMB_CHANCE = 1 / 6;
const BOMB_LIFETIME_MS = 2000; // bomb auto-disappears after this many ms
const MIN_DIST = LOGO_SIZE + 8; // minimum centre-to-centre distance between any two targets
const MAX_PLACEMENT_TRIES = 20;

interface Target {
  id: string;
  x: number;
  y: number;
  isBomb: boolean;
  spawnedAt: number; // epoch ms — used to expire bombs
}

interface PlayerSlot {
  targets: Target[];  // all active targets (logos + at most 1 bomb)
  bombsShown: number;
}

interface State {
  playerIds: string[];
  slots: Record<string, PlayerSlot>;
  hits: Record<string, number>;
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

let _counter = 0;
function nextId(): string {
  return `t${Date.now()}-${_counter++}`;
}

/** Try to place a new target that doesn't overlap existing ones. Falls back to random after MAX_PLACEMENT_TRIES. */
function placeTarget(existing: Target[], isBomb: boolean): Target {
  const now = Date.now();
  for (let i = 0; i < MAX_PLACEMENT_TRIES; i++) {
    const x = Math.floor(Math.random() * (AREA_W - LOGO_SIZE));
    const y = Math.floor(Math.random() * (AREA_H - LOGO_SIZE));
    const cx = x + LOGO_SIZE / 2;
    const cy = y + LOGO_SIZE / 2;
    const overlaps = existing.some((t) => {
      const dx = cx - (t.x + LOGO_SIZE / 2);
      const dy = cy - (t.y + LOGO_SIZE / 2);
      return Math.sqrt(dx * dx + dy * dy) < MIN_DIST;
    });
    if (!overlaps) return { id: nextId(), x, y, isBomb, spawnedAt: now };
  }
  return {
    id: nextId(),
    x: Math.floor(Math.random() * (AREA_W - LOGO_SIZE)),
    y: Math.floor(Math.random() * (AREA_H - LOGO_SIZE)),
    isBomb,
    spawnedAt: now,
  };
}

/** Build the initial slot: MAX_LOGOS logos, no bomb on first spawn. */
function initSlot(): PlayerSlot {
  const targets: Target[] = [];
  for (let i = 0; i < MAX_LOGOS; i++) {
    targets.push(placeTarget(targets, false));
  }
  return { targets, bombsShown: 0 };
}

/** After a logo is tapped: replace it with a new logo (and maybe add a bomb if none active). */
function spawnLogo(slot: PlayerSlot): PlayerSlot {
  const hasBomb = slot.targets.some((t) => t.isBomb);
  const canShowBomb = !hasBomb && slot.bombsShown < MAX_BOMBS;
  const showBomb = canShowBomb && Math.random() < BOMB_CHANCE;
  const newTargets = [...slot.targets];
  newTargets.push(placeTarget(newTargets, false));
  if (showBomb) {
    newTargets.push(placeTarget(newTargets, true));
  }
  return {
    targets: newTargets,
    bombsShown: slot.bombsShown + (showBomb ? 1 : 0),
  };
}

/** Expire any bomb whose BOMB_LIFETIME_MS has elapsed.
 *  Returns the slot unchanged if nothing expired, or a new slot with bomb removed and a fresh replacement placed.
 */
export function expireBombs(slot: PlayerSlot): { slot: PlayerSlot; expired: boolean } {
  const now = Date.now();
  const liveBomb = slot.targets.find((t) => t.isBomb);
  if (!liveBomb || now - liveBomb.spawnedAt < BOMB_LIFETIME_MS) {
    return { slot, expired: false };
  }
  // Bomb has expired — remove it and place a new logo in its position
  const withoutBomb = slot.targets.filter((t) => !t.isBomb);
  const newLogo = placeTarget(withoutBomb, false);
  return {
    slot: { ...slot, targets: [...withoutBomb, newLogo] },
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
    for (const id of playerIds) {
      slots[id] = initSlot();
    }
    return {
      playerIds,
      slots,
      hits: Object.fromEntries(playerIds.map((id) => [id, 0])),
    };
  },
  publicState(s) {
    // Strip spawnedAt before sending to clients; also expire any bombs whose time has passed
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
    if (tIdx === -1) return { ...s, slots: { ...s.slots, [playerId]: freshSlot } }; // stale tap but apply expiry

    const tapped = freshSlot.targets[tIdx];
    const remaining = freshSlot.targets.filter((_, i) => i !== tIdx);

    if (tapped.isBomb) {
      return {
        ...s,
        hits: { ...s.hits, [playerId]: (s.hits[playerId] ?? 0) - 2 },
        slots: { ...s.slots, [playerId]: { ...freshSlot, targets: remaining } },
      };
    }

    // Logo tapped: +1 pt, remove this logo and spawn a replacement
    const afterRemove: PlayerSlot = { ...freshSlot, targets: remaining };
    const newSlot = spawnLogo(afterRemove);
    return {
      ...s,
      hits: { ...s.hits, [playerId]: (s.hits[playerId] ?? 0) + 1 },
      slots: { ...s.slots, [playerId]: newSlot },
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
