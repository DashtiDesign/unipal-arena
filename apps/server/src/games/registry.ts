import { GameDefinition } from "@arena/shared";
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
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const REGISTRY = new Map<string, GameDefinition<any, any>>(
  ALL.map((g) => [g.id, g])
);

export const ALL_GAME_IDS: string[] = ALL.map((g) => g.id);

/** Fisher-Yates shuffle in place */
function shuffleIds(ids: string[]): string[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function freshDeck(): string[] {
  return shuffleIds(ALL_GAME_IDS);
}

/**
 * Pop the next game id from the deck. If the deck is empty, reshuffle a fresh
 * one and pop from that. Mutates the passed-in array.
 */
export function nextFromDeck(deck: string[]): GameDefinition {
  if (deck.length === 0) {
    const fresh = freshDeck();
    deck.push(...fresh);
  }
  const id = deck.pop()!;
  return REGISTRY.get(id)!;
}
