import { GameDefinition, EXPERIMENTAL_GAME_IDS } from "@arena/shared";
import quickMaths from "./quickMaths";
import tappingSpeed from "./tappingSpeed";
import reactionGreen from "./reactionGreen";
import memoryGrid from "./memoryGrid";
import rockPaperScissors from "./rockPaperScissors";
import higherLower from "./higherLower";
import ticTacToe from "./ticTacToe";
import emojiOddOneOut from "./emojiOddOneOut";
import stopAt10s from "./stopAt10s";
import whackALogo from "./whackALogo";
import paperToss from "./paperToss";
import darts from "./darts";
import miniGolf from "./miniGolf";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL: GameDefinition<any, any>[] = [
  quickMaths,
  tappingSpeed,
  reactionGreen,
  memoryGrid,
  rockPaperScissors,
  higherLower,
  ticTacToe,
  emojiOddOneOut,
  stopAt10s,
  whackALogo,
  paperToss,
  darts,
  miniGolf,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const REGISTRY = new Map<string, GameDefinition<any, any>>(
  ALL.map((g) => [g.id, g])
);

export const ALL_GAME_IDS: string[] = ALL.map((g) => g.id);

/** IDs of games in the default rotation (excludes experimental). */
export const MAIN_GAME_IDS: string[] = ALL_GAME_IDS.filter(
  (id) => !EXPERIMENTAL_GAME_IDS.includes(id)
);

/**
 * Mulberry32 seeded PRNG — deterministic, fast, good distribution.
 * Returns a function that produces pseudo-random floats in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Convert a string to a numeric seed via a simple djb2-like hash. */
function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

/** Fisher-Yates shuffle using an optional seeded PRNG (falls back to Math.random). */
function shuffleIds(ids: string[], rand?: () => number): string[] {
  const a = [...ids];
  const r = rand ?? Math.random;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Create a fresh shuffled deck of game IDs.
 * @param enabledIds  Which game IDs are eligible (filtered to known REGISTRY entries).
 * @param seed        Optional string seed for deterministic shuffle (roomCode + deckCycle).
 */
export function freshDeck(enabledIds?: string[], seed?: string): string[] {
  const ids = enabledIds ? enabledIds.filter((id) => REGISTRY.has(id)) : ALL_GAME_IDS;
  const base = ids.length > 0 ? ids : ALL_GAME_IDS;
  const rand = seed !== undefined ? mulberry32(hashSeed(seed)) : undefined;
  return shuffleIds(base, rand);
}

/**
 * Pop the next game id from the deck. If the deck is empty, reshuffle a fresh
 * one and pop from that. Mutates the passed-in array.
 * If `lastId` is provided, skip that id (never repeat the same game back-to-back).
 * If `enabledIds` is provided, uses them when reshuffling an empty deck.
 * If `seed` is provided, the new deck is shuffled deterministically.
 */
export function nextFromDeck(deck: string[], lastId?: string, enabledIds?: string[], seed?: string): GameDefinition {
  if (deck.length === 0) {
    const fresh = freshDeck(enabledIds, seed);
    deck.push(...fresh);
  }
  // If the next candidate matches lastId and there are other games available, skip it.
  if (lastId && deck.length > 1 && deck[deck.length - 1] === lastId) {
    // Swap the top with the one below it to avoid immediate repeat
    const tmp = deck[deck.length - 1];
    deck[deck.length - 1] = deck[deck.length - 2];
    deck[deck.length - 2] = tmp;
  }
  const id = deck.pop()!;
  return REGISTRY.get(id)!;
}
