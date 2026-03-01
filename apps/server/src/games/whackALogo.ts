import { GameDefinition } from "@arena/shared";

const LOGO_SIZE = 80; // px — matches client logo size
const AREA_W = 320;   // safe play area width (client uses same constant)
const AREA_H = 340;   // safe play area height
const MAX_BOMBS = 3;  // max bomb appearances per player per match
// Probability a new target spawned is a bomb (approx 1-in-6 chance, capped by MAX_BOMBS)
const BOMB_CHANCE = 1 / 6;

interface Target {
  id: string;       // unique tap token — server validates this
  x: number;        // left offset inside play area (0..AREA_W - LOGO_SIZE)
  y: number;        // top offset inside play area (0..AREA_H - LOGO_SIZE)
  isBomb: boolean;  // if true, tapping costs -2 pts instead of +1
}

interface State {
  playerIds: string[];
  targets: Record<string, Target>;    // current active target per player
  hits: Record<string, number>;       // net score per player (can go negative)
  bombsShown: Record<string, number>; // how many bombs have been shown to this player
}

interface Public {
  targets: Record<string, Target>;    // each player sees all targets; client shows own
  hits: Record<string, number>;
}

let _counter = 0;
function nextTargetId(): string {
  return `t${Date.now()}-${_counter++}`;
}

function randomTarget(id: string, isBomb: boolean): Target {
  return {
    id,
    isBomb,
    x: Math.floor(Math.random() * (AREA_W - LOGO_SIZE)),
    y: Math.floor(Math.random() * (AREA_H - LOGO_SIZE)),
  };
}

function spawnNext(bombsShownSoFar: number): Target {
  const canShowBomb = bombsShownSoFar < MAX_BOMBS;
  const isBomb = canShowBomb && Math.random() < BOMB_CHANCE;
  return randomTarget(nextTargetId(), isBomb);
}

const whackALogo: GameDefinition<State, Public> = {
  id: "whack_a_logo",
  displayName: { en: "Whack a Logo", ar: "اضرب الشعار" },
  durationMs: 15000,
  instructions: {
    en: "Tap the logo as many times as you can! Avoid the 💣 bomb — it costs 2 points. Most points wins.",
    ar: "انقر على الشعار أكبر عدد ممكن من المرات! تجنب 💣 القنبلة — تكلفك نقطتين. الأكثر نقاطاً يفوز.",
  },
  init(playerIds) {
    const targets: Record<string, Target> = {};
    const bombsShown: Record<string, number> = {};
    for (const id of playerIds) {
      targets[id] = randomTarget(nextTargetId(), false); // first target is always safe
      bombsShown[id] = 0;
    }
    return {
      playerIds,
      targets,
      hits: Object.fromEntries(playerIds.map((id) => [id, 0])),
      bombsShown,
    };
  },
  publicState(s) {
    return { targets: s.targets, hits: s.hits };
  },
  input(s, playerId, payload) {
    const { targetId } = payload as { targetId: string };
    const current = s.targets[playerId];
    // Validate: the tapped targetId must match the player's current target
    if (current?.id !== targetId) return s;

    const delta = current.isBomb ? -2 : 1;
    const newScore = (s.hits[playerId] ?? 0) + delta;

    const newBombsShown = current.isBomb
      ? { ...s.bombsShown, [playerId]: (s.bombsShown[playerId] ?? 0) + 1 }
      : s.bombsShown;

    return {
      ...s,
      hits: { ...s.hits, [playerId]: newScore },
      bombsShown: newBombsShown,
      targets: {
        ...s.targets,
        [playerId]: spawnNext(newBombsShown[playerId] ?? 0),
      },
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
    return { outcomeByPlayerId, stats: { hits: s.hits, bombsShown: s.bombsShown } };
  },
};

export default whackALogo;
