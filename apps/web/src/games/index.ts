import { GameRegistryEntry } from "./types";
import QuickMaths from "./QuickMaths";
import TappingSpeed from "./TappingSpeed";
import ReactionGreen from "./ReactionGreen";
import MemoryGrid from "./MemoryGrid";
import RockPaperScissors from "./RockPaperScissors";
import HigherLower from "./HigherLower";
import TicTacToe from "./TicTacToe";
import EmojiOddOneOut from "./EmojiOddOneOut";
import StopAt10s from "./StopAt10s";
import WhackALogo from "./WhackALogo";

const ALL: GameRegistryEntry[] = [
  { id: "quick_maths",        component: QuickMaths },
  { id: "tapping_speed",      component: TappingSpeed },
  { id: "reaction_green",     component: ReactionGreen },
  { id: "memory_grid",        component: MemoryGrid },
  { id: "rock_paper_scissors",component: RockPaperScissors },
  { id: "higher_lower",       component: HigherLower },
  { id: "tic_tac_toe",        component: TicTacToe },
  { id: "emoji_odd_one_out",  component: EmojiOddOneOut },
  { id: "stop_at_10s",        component: StopAt10s },
  { id: "whack_a_logo",       component: WhackALogo },
];

export const GAME_REGISTRY = new Map<string, GameRegistryEntry>(
  ALL.map((e) => [e.id, e])
);
