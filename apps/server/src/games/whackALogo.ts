import { GameDefinition } from "@arena/shared";

const LOGO_SIZE = 80; // px — matches client logo size
const AREA_W = 320;   // safe play area width (client uses same constant)
const AREA_H = 340;   // safe play area height
const MAX_BOMBS = 3;  // max bomb appearances per player per match
const BOMB_CHANCE = 1 / 6;

interface Target {
  id: string;
  x: number;
  y: number;
}

interface PlayerSlot {
  logo: Target;
  bomb: Target | null; // present alongside logo when a bomb is active
  bombsShown: number;
}

interface State {
  playerIds: string[];
  slots: Record<string, PlayerSlot>; // per-player
  hits: Record<string, number>;      // net score per player (can go negative)
}

interface Public {
  slots: Record<string, { logo: Target; bomb: Target | null }>;
  hits: Record<string, number>;
}

let _counter = 0;
function nextId(): string {
  return `t${Date.now()}-${_counter++}`;
}

function randomPos(): { x: number; y: number } {
  return {
    x: Math.floor(Math.random() * (AREA_W - LOGO_SIZE)),
    y: Math.floor(Math.random() * (AREA_H - LOGO_SIZE)),
  };
}

function randomTarget(): Target {
  return { id: nextId(), ...randomPos() };
}

/** Spawn a fresh logo + optional bomb. */
function spawnSlot(bombsShownSoFar: number): PlayerSlot {
  const canShowBomb = bombsShownSoFar < MAX_BOMBS;
  const showBomb = canShowBomb && Math.random() < BOMB_CHANCE;
  const bombsShown = bombsShownSoFar + (showBomb ? 1 : 0);
  return {
    logo: randomTarget(),
    bomb: showBomb ? randomTarget() : null,
    bombsShown,
  };
}

const whackALogo: GameDefinition<State, Public> = {
  id: "whack_a_logo",
  displayName: { en: "Whack a Logo", ar: "اضرب الشعار" },
  durationMs: 15000,
  instructions: {
    en: "Tap the logo (+1 pt) as fast as you can! A 💣 bomb may appear — tap it for −2 pts, or tap the logo to clear both. Most points wins.",
    ar: "انقر على الشعار (+1 نقطة) بأسرع ما يمكن! قد تظهر 💣 قنبلة — انقرها مقابل −2 نقطة، أو انقر الشعار لمسحها معاً. الأكثر نقاطاً يفوز.",
  },
  init(playerIds) {
    const slots: Record<string, PlayerSlot> = {};
    for (const id of playerIds) {
      // First slot is always safe (no bomb)
      slots[id] = { logo: randomTarget(), bomb: null, bombsShown: 0 };
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
        s.playerIds.map((id) => [id, { logo: s.slots[id].logo, bomb: s.slots[id].bomb }])
      ),
      hits: s.hits,
    };
  },
  input(s, playerId, payload) {
    const { targetId } = payload as { targetId: string };
    const slot = s.slots[playerId];
    if (!slot) return s;

    // Bomb tapped: deduct points, clear bomb only — logo stays
    if (slot.bomb && slot.bomb.id === targetId) {
      const newScore = (s.hits[playerId] ?? 0) - 2;
      return {
        ...s,
        hits: { ...s.hits, [playerId]: newScore },
        slots: {
          ...s.slots,
          [playerId]: { ...slot, bomb: null },
        },
      };
    }

    // Logo tapped: +1 pt, spawn entirely new slot (new logo + maybe bomb)
    if (slot.logo.id === targetId) {
      const newScore = (s.hits[playerId] ?? 0) + 1;
      return {
        ...s,
        hits: { ...s.hits, [playerId]: newScore },
        slots: {
          ...s.slots,
          [playerId]: spawnSlot(slot.bombsShown),
        },
      };
    }

    return s; // stale tap, ignore
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
