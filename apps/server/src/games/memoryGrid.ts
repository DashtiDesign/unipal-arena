import { GameDefinition } from "@arena/shared";

const GRID_SIZE = 16;   // 4×4
const NUM_CELLS = 5;    // cells to remember
const REVEAL_MS = 3000; // show for 3s

interface State {
  playerIds: string[];
  targets: number[];           // sorted indices of highlighted cells
  showUntil: number;           // epoch ms — server sets, client hides after this
  answers: Record<string, number[]>;  // player -> cells tapped so far
  locked: Record<string, boolean>;    // wrong answer = locked out
  finishedAt: Record<string, number>; // playerId -> epoch ms when they completed correctly
}

interface Public {
  targets: number[] | null;    // revealed during memorize phase, null after
  showUntil: number;           // epoch ms — client uses this to hide grid
  tappedCount: Record<string, number>;
  locked: Record<string, boolean>;
  // Revealed once both done (correct or locked); null while waiting
  results: Record<string, { correct: boolean; elapsedMs: number }> | null;
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

function isDone(s: State, playerId: string): boolean {
  return playerId in s.finishedAt || s.locked[playerId];
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
      finishedAt: {},
    };
  },
  publicState(s) {
    const now = Date.now();
    const allDone = s.playerIds.every((id) => isDone(s, id));
    return {
      targets: now < s.showUntil ? s.targets : null,
      showUntil: s.showUntil,
      tappedCount: Object.fromEntries(s.playerIds.map((id) => [id, (s.answers[id] ?? []).length])),
      locked: s.locked,
      results: allDone
        ? Object.fromEntries(s.playerIds.map((id) => [id, {
            correct: id in s.finishedAt,
            elapsedMs: s.finishedAt[id] ?? 0,
          }]))
        : null,
      numCells: NUM_CELLS,
    };
  },
  input(s, playerId, payload) {
    if (Date.now() < s.showUntil) return s;
    if (isDone(s, playerId)) return s; // already finished or locked

    const cell = (payload as { cell: number }).cell;
    if (!Number.isInteger(cell) || cell < 0 || cell >= GRID_SIZE) return s;

    const current = s.answers[playerId] ?? [];
    if (current.includes(cell)) return s;

    if (!s.targets.includes(cell)) {
      // Wrong tap — lock out this player
      return { ...s, locked: { ...s.locked, [playerId]: true } };
    }

    const next = [...current, cell].sort((a, b) => a - b);
    const complete = next.length === s.targets.length &&
      next.every((v, i) => v === s.targets[i]);

    return {
      ...s,
      answers: { ...s.answers, [playerId]: next },
      finishedAt: complete
        ? { ...s.finishedAt, [playerId]: Date.now() }
        : s.finishedAt,
    };
  },
  isResolved(s) {
    return s.playerIds.every((id) => isDone(s, id));
  },
  resolve(s) {
    const outcomeByPlayerId: Record<string, number> = {};
    const results: Record<string, { correct: boolean; elapsedMs: number }> = {};

    for (const id of s.playerIds) {
      const correct = id in s.finishedAt;
      const elapsedMs = s.finishedAt[id] ?? Infinity;
      results[id] = { correct, elapsedMs };
    }

    const correctPlayers = s.playerIds.filter((id) => results[id].correct);

    if (correctPlayers.length === 0) {
      for (const id of s.playerIds) outcomeByPlayerId[id] = 0.5;
    } else if (correctPlayers.length === 2) {
      const [a, b] = s.playerIds;
      const diff = Math.abs(results[a].elapsedMs - results[b].elapsedMs);
      if (diff <= 50) {
        outcomeByPlayerId[a] = 0.5;
        outcomeByPlayerId[b] = 0.5;
      } else {
        const faster = results[a].elapsedMs < results[b].elapsedMs ? a : b;
        for (const id of s.playerIds) outcomeByPlayerId[id] = id === faster ? 1 : 0;
      }
    } else {
      for (const id of s.playerIds) {
        outcomeByPlayerId[id] = results[id].correct ? 1 : 0;
      }
    }

    return {
      outcomeByPlayerId,
      stats: { targets: s.targets, locked: s.locked, results },
    };
  },
};

export default memoryGrid;
