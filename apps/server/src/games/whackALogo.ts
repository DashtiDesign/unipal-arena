import { GameDefinition } from "@arena/shared";

const LOGO_SIZE = 80; // px — matches client logo size
const AREA_W = 320;   // safe play area width (client uses same constant)
const AREA_H = 340;   // safe play area height

interface Target {
  id: string;   // unique tap token — server validates this
  x: number;   // left offset inside play area (0..AREA_W - LOGO_SIZE)
  y: number;   // top offset inside play area (0..AREA_H - LOGO_SIZE)
}

interface State {
  playerIds: string[];
  targets: Record<string, Target>;  // current active target per player
  hits: Record<string, number>;     // total hits per player
  nextId: number;                   // counter for generating unique target IDs
}

interface Public {
  targets: Record<string, Target>;  // each player sees all targets (for spectating), client shows own
  hits: Record<string, number>;
}

let _counter = 0;
function nextTargetId(): string {
  return `t${Date.now()}-${_counter++}`;
}

function randomTarget(id: string): Target {
  return {
    id,
    x: Math.floor(Math.random() * (AREA_W - LOGO_SIZE)),
    y: Math.floor(Math.random() * (AREA_H - LOGO_SIZE)),
  };
}

const whackALogo: GameDefinition<State, Public> = {
  id: "whack_a_logo",
  displayName: { en: "Whack a Logo", ar: "اضرب الشعار" },
  durationMs: 15000,
  instructions: {
    en: "Tap the logo as many times as you can! Most taps wins.",
    ar: "انقر على الشعار أكبر عدد ممكن من المرات! الأكثر نقرات يفوز.",
  },
  init(playerIds) {
    const targets: Record<string, Target> = {};
    for (const id of playerIds) {
      targets[id] = randomTarget(nextTargetId());
    }
    return {
      playerIds,
      targets,
      hits: Object.fromEntries(playerIds.map((id) => [id, 0])),
      nextId: 0,
    };
  },
  publicState(s) {
    return { targets: s.targets, hits: s.hits };
  },
  input(s, playerId, payload) {
    const { targetId } = payload as { targetId: string };
    // Validate: the tapped targetId must match the player's current target
    if (s.targets[playerId]?.id !== targetId) return s;
    // Hit registered — spawn a new target at a fresh position for this player
    return {
      ...s,
      hits: { ...s.hits, [playerId]: (s.hits[playerId] ?? 0) + 1 },
      targets: {
        ...s.targets,
        [playerId]: randomTarget(nextTargetId()),
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
    return { outcomeByPlayerId, stats: { hits: s.hits } };
  },
};

export default whackALogo;
