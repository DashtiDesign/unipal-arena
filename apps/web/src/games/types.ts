import { Lang } from "../i18n";

export interface GameComponentProps {
  /** The public state broadcast from the server */
  publicState: unknown;
  /** My socket id */
  playerId: string;
  /** Opponent socket id */
  opponentId: string;
  /** Milliseconds remaining in this game */
  remainingMs: number;
  /** Send an input to the server */
  onInput: (payload: unknown) => void;
  lang: Lang;
  /** Accumulated private events sent only to this player (e.g. hidden hints) */
  privateState?: unknown[];
}

export interface GameRegistryEntry {
  id: string;
  component: React.ComponentType<GameComponentProps>;
}
