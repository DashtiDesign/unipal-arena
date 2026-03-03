import { Lang } from "../i18n";

export interface GameComponentProps {
  /** The public state broadcast from the server */
  publicState: unknown;
  /** My stable playerId */
  playerId: string;
  /** Opponent stable playerId */
  opponentId: string;
  /** Milliseconds remaining in this game */
  remainingMs: number;
  /** Send an input to the server */
  onInput: (payload: unknown) => void;
  lang: Lang;
  /** Accumulated private events sent only to this player (e.g. hidden hints) */
  privateState?: unknown[];
  /**
   * Server clock offset: eventServerTime = Date.now() + clockOffsetMs.
   * Computed from 3 CLOCK_PING/PONG samples (median). Zero until calibrated.
   */
  clockOffsetMs?: number;
}

export interface GameRegistryEntry {
  id: string;
  component: React.ComponentType<GameComponentProps>;
}
