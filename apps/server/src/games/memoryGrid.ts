import { GameDefinition } from "@arena/shared";

const GRID_SIZE = 16;   // 4×4
const NUM_CELLS = 4;    // cells to remember
const REVEAL_MS = 3000; // show for 3s

interface State {
  playerIds: string[];
  targets: number[];           // sorted indices of highlighted cells
  showUntil: number;           // epoch ms — server sets, client hides after this
  answers: Record<string, number[]>;  // player -> cells tapped so far
  locked: Record<string, boolean>;    // wrong answer = locked out
  firstCorrect: string | null;
}

interface Public {
  targets: number[] | null;    // revealed during memorize phase, null after
  showUntil: number;           // epoch ms — client uses this to hide grid
  tappedCount: Record<string, number>;
  locked: Record<string, boolean>;
  firstCorrect: string | null;
  numCells: number;            // how many cells to find
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const memoryGrid: GameDefinition<State, Public> = {
  id: "memory_grid",
  displayName: { en: "Memory Grid", ar: "شبكة الذاكرة" },
  durationMs: 15000, // 3s reveal + 12s to answer
  instructions: {
    en: "Memorize the highlighted cells, then tap them all! First correct wins.",
    ar: "احفظ الخلايا المضيئة، ثم انقر عليها جميعاً! أول إجابة صحيحة تفوز.",
  },
  init(playerIds) {
    const indices = Array.from({ length: GRID_SIZE }, (_, i) => i);
    const targets = shuffle(indices).slice(0, NUM_CELLS).sort((a, b) => a - b);
    return {
      playerIds,
      targets,
      showUntil: Date.now() + REVEAL_MS,
      answers: Object.fromEntries(playerIds.map((id) => [id, []])),
      locked: Object.fromEntries(playerIds.map((id) => [id, false])),
      firstCorrect: null,
    };
  },
  publicState(s) {
    const now = Date.now();
    return {
      // Only reveal targets during the memorize window
      targets: now < s.showUntil ? s.targets : null,
      showUntil: s.showUntil,
      tappedCount: Object.fromEntries(s.playerIds.map((id) => [id, (s.answers[id] ?? []).length])),
      locked: s.locked,
      firstCorrect: s.firstCorrect,
      numCells: NUM_CELLS,
    };
  },
  input(s, playerId, payload) {
    // Can't tap during reveal phase, if locked, or if already correct
    if (Date.now() < s.showUntil) return s;
    if (s.locked[playerId] || s.firstCorrect) return s;

    const cell = (payload as { cell: number }).cell;
    if (!Number.isInteger(cell) || cell < 0 || cell >= GRID_SIZE) return s;

    const current = s.answers[playerId] ?? [];
    if (current.includes(cell)) return s; // already tapped this cell

    // Check if this cell is a valid target
    if (!s.targets.includes(cell)) {
      // Wrong tap — lock out this player
      return { ...s, locked: { ...s.locked, [playerId]: true } };
    }

    const next = [...current, cell].sort((a, b) => a - b);

    // Check if complete
    const isDone = next.length === s.targets.length &&
      next.every((v, i) => v === s.targets[i]);

    return {
      ...s,
      answers: { ...s.answers, [playerId]: next },
      firstCorrect: isDone ? playerId : s.firstCorrect,
    };
  },
  resolve(s) {
    const outcomeByPlayerId: Record<string, number> = {};
    if (s.firstCorrect) {
      for (const id of s.playerIds) {
        outcomeByPlayerId[id] = id === s.firstCorrect ? 1 : 0;
      }
    } else {
      // Both locked out or time expired — draw
      for (const id of s.playerIds) outcomeByPlayerId[id] = 0.5;
    }
    return {
      outcomeByPlayerId,
      stats: { targets: s.targets, answers: s.answers, locked: s.locked },
    };
  },
};

export default memoryGrid;
