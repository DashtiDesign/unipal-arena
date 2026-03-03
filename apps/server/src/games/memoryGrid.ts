import { GameDefinition } from "@arena/shared";

const GRID_SIZE = 16;   // 4×4
const NUM_CELLS = 5;    // cells to remember
const REVEAL_MS = 3000; // show for 3s

interface State {
  playerIds: string[];
  targets: number[];
  showUntil: number;
  answers: Record<string, number[]>;
  finishedAt: Record<string, number>; // playerId -> elapsedMs since showUntil when they tapped 5 cells
  // Track which players have submitted (tapped all 5), to guard against re-submissions
  submitted: Record<string, boolean>;
}

interface Public {
  targets: number[] | null;
  showUntil: number;
  tappedCount: Record<string, number>;
  results: Record<string, { correct: boolean; elapsedMs: number }> | null;
  numCells: number;
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
  return s.submitted[playerId] === true;
}

function isCorrect(s: State, playerId: string): boolean {
  const tapped = [...(s.answers[playerId] ?? [])].sort((a, b) => a - b);
  if (tapped.length !== s.targets.length) return false;
  return tapped.every((v, i) => v === s.targets[i]);
}

const memoryGrid: GameDefinition<State, Public> = {
  id: "memory_grid",
  displayName: { en: "Memory Grid", ar: "شبكة الذاكرة" },
  durationMs: 15000,
  instructions: {
    en: "Memorize the highlighted cells, then tap all 5! Correct beats wrong — ties broken by speed.",
    ar: "احفظ الخلايا المضيئة، ثم انقر على جميع الـ5! الصواب يتفوق على الخطأ — التعادل يُكسر بالسرعة.",
  },
  init(playerIds) {
    const indices = Array.from({ length: GRID_SIZE }, (_, i) => i);
    const targets = shuffle(indices).slice(0, NUM_CELLS).sort((a, b) => a - b);
    return {
      playerIds,
      targets,
      showUntil: Date.now() + REVEAL_MS,
      answers: Object.fromEntries(playerIds.map((id) => [id, []])),
      finishedAt: {},
      submitted: Object.fromEntries(playerIds.map((id) => [id, false])),
    };
  },
  publicState(s) {
    const now = Date.now();
    const allDone = s.playerIds.every((id) => isDone(s, id));
    return {
      targets: now < s.showUntil ? s.targets : null,
      showUntil: s.showUntil,
      tappedCount: Object.fromEntries(s.playerIds.map((id) => [id, (s.answers[id] ?? []).length])),
      results: allDone
        ? Object.fromEntries(s.playerIds.map((id) => [id, {
            correct: isCorrect(s, id),
            elapsedMs: s.finishedAt[id] ?? 0,
          }]))
        : null,
      numCells: NUM_CELLS,
    };
  },
  input(s, playerId, payload) {
    // Reject during reveal phase
    if (Date.now() < s.showUntil) return s;
    // Guard: already submitted (tapped all 5) — never allow re-submission
    if (isDone(s, playerId)) return s;

    const cell = (payload as { cell: number }).cell;
    if (!Number.isInteger(cell) || cell < 0 || cell >= GRID_SIZE) return s;

    const current = s.answers[playerId] ?? [];
    if (current.includes(cell)) return s; // no duplicate taps

    const next = [...current, cell];
    const finished = next.length === NUM_CELLS;

    const elapsedMs = finished ? Math.max(0, Date.now() - s.showUntil) : undefined;

    return {
      ...s,
      answers: { ...s.answers, [playerId]: next },
      finishedAt: finished ? { ...s.finishedAt, [playerId]: elapsedMs! } : s.finishedAt,
      // Mark submitted immediately when player taps 5th cell — never flip back to false
      submitted: finished ? { ...s.submitted, [playerId]: true } : s.submitted,
    };
  },
  isResolved(s) {
    // Resolve only when both players have submitted all 5 cells.
    // Timer expiry is handled by the tick loop — no early-resolve here.
    return s.playerIds.every((id) => isDone(s, id));
  },
  resolve(s) {
    const outcomeByPlayerId: Record<string, number> = {};
    const results: Record<string, { correct: boolean; elapsedMs: number }> = {};

    for (const id of s.playerIds) {
      results[id] = {
        correct: isCorrect(s, id),
        elapsedMs: s.finishedAt[id] ?? Infinity,
      };
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
      stats: { targets: s.targets, results },
    };
  },
};

export default memoryGrid;
