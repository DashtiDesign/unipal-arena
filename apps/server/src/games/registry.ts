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

/** Fisher-Yates shuffle in place */
function shuffleIds(ids: string[]): string[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function freshDeck(enabledIds?: string[]): string[] {
  const ids = enabledIds ? enabledIds.filter((id) => REGISTRY.has(id)) : ALL_GAME_IDS;
  return shuffleIds(ids.length > 0 ? ids : ALL_GAME_IDS);
}

/**
 * Pop the next game id from the deck. If the deck is empty, reshuffle a fresh
 * one and pop from that. Mutates the passed-in array.
 * If `lastId` is provided, skip that id (never repeat the same game back-to-back).
 * If `enabledIds` is provided, uses them when reshuffling an empty deck.
 */
export function nextFromDeck(deck: string[], lastId?: string, enabledIds?: string[]): GameDefinition {
  if (deck.length === 0) {
    const fresh = freshDeck(enabledIds);
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
