import { GameDefinition } from "@arena/shared";

const LOGO_SIZE = 80; // px — matches client logo size
const AREA_W = 320;   // safe play area width (client uses same constant)
const AREA_H = 340;   // safe play area height
const MAX_LOGOS = 3;  // max simultaneous logos per player
const MAX_BOMBS = 3;  // max bomb appearances per player per match
const BOMB_CHANCE = 1 / 6;
const MIN_DIST = LOGO_SIZE + 8; // minimum centre-to-centre distance between any two targets
const MAX_PLACEMENT_TRIES = 20;

interface Target {
  id: string;
  x: number;
  y: number;
  isBomb: boolean;
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

interface Public {
  slots: Record<string, { targets: Target[] }>;
  hits: Record<string, number>;
}

let _counter = 0;
function nextId(): string {
  return `t${Date.now()}-${_counter++}`;
}

/** Try to place a new target that doesn't overlap existing ones. Falls back to random after MAX_PLACEMENT_TRIES. */
function placeTarget(existing: Target[], isBomb: boolean): Target {
  for (let i = 0; i < MAX_PLACEMENT_TRIES; i++) {
    const x = Math.floor(Math.random() * (AREA_W - LOGO_SIZE));
    const y = Math.floor(Math.random() * (AREA_H - LOGO_SIZE));
    // centre-to-centre distance check
    const cx = x + LOGO_SIZE / 2;
    const cy = y + LOGO_SIZE / 2;
    const overlaps = existing.some((t) => {
      const dx = cx - (t.x + LOGO_SIZE / 2);
      const dy = cy - (t.y + LOGO_SIZE / 2);
      return Math.sqrt(dx * dx + dy * dy) < MIN_DIST;
    });
    if (!overlaps) return { id: nextId(), x, y, isBomb };
  }
  // fallback — just place randomly (shouldn't happen often)
  return {
    id: nextId(),
    x: Math.floor(Math.random() * (AREA_W - LOGO_SIZE)),
    y: Math.floor(Math.random() * (AREA_H - LOGO_SIZE)),
    isBomb,
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
    return {
      slots: Object.fromEntries(
        s.playerIds.map((id) => [id, { targets: s.slots[id].targets }])
      ),
      hits: s.hits,
    };
  },
  input(s, playerId, payload) {
    const { targetId } = payload as { targetId: string };
    const slot = s.slots[playerId];
    if (!slot) return s;

    const tIdx = slot.targets.findIndex((t) => t.id === targetId);
    if (tIdx === -1) return s; // stale tap, ignore

    const tapped = slot.targets[tIdx];
    const remaining = slot.targets.filter((_, i) => i !== tIdx);

    if (tapped.isBomb) {
      // Bomb tapped: −2 pts, remove bomb only
      return {
        ...s,
        hits: { ...s.hits, [playerId]: (s.hits[playerId] ?? 0) - 2 },
        slots: { ...s.slots, [playerId]: { ...slot, targets: remaining } },
      };
    }

    // Logo tapped: +1 pt, remove this logo and spawn a replacement
    const afterRemove: PlayerSlot = { ...slot, targets: remaining };
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
