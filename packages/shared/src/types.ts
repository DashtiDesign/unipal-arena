export interface Player {
  id: string;
  name: string;
  isReady: boolean;
  score: number;
  /** Server-computed clock offset: eventServerTime = clientNowMs + clockOffsetMs */
  clockOffsetMs: number;
  /** "connected" when actively connected; "disconnected" during the 60s grace window */
  connectionStatus: "connected" | "disconnected";
  /** Epoch ms when this player disconnected (only set when connectionStatus = "disconnected") */
  disconnectedAt?: number;
  /** Epoch ms after which the player is moved to room.disconnectedPlayers */
  reconnectDeadlineAt?: number;
}

/** Snapshot of a player who exceeded the 60s reconnect window and was evicted from active list. */
export interface DisconnectedPlayer {
  id: string;
  name: string;
  score: number;
  disconnectedAt: number;
}

/** Allowed winning score values */
export const WIN_SCORE_OPTIONS = [10, 15, 20] as const;
export type WinScoreOption = typeof WIN_SCORE_OPTIONS[number];

/** Minimum number of MAIN games that must be enabled */
export const MIN_ENABLED_GAMES = 5;

/**
 * Experimental games are hidden from the default rotation.
 * The lobby host must explicitly enable them in Game Settings.
 */
export const EXPERIMENTAL_GAME_IDS: ReadonlyArray<string> = [
  "paper_toss",
  "darts",
  "mini_golf",
] as const;

export interface RoomSettings {
  enabledGameIds: string[];   // subset of all known game IDs; main games must have >= MIN_ENABLED_GAMES
  winScore: WinScoreOption;   // tournament ends when a player reaches this score
}

export interface Room {
  id: string; // 4-digit string e.g. "0472"
  hostId: string;
  players: Player[];
  createdAt: number;
  settings: RoomSettings;
  /** Players who exceeded the 60s reconnect window; can rejoin with same playerId to restore score. */
  disconnectedPlayers: DisconnectedPlayer[];
}

// ── Arena ────────────────────────────────────────────────────────────────────

export type ArenaPhase =
  | "LOBBY"       // waiting for players, not started
  | "PRE_ROUND"   // game selected, showing instructions + ready button before game starts
  | "DUELING"     // game in progress
  | "RESULT"      // duel just ended, showing result screen
  | "FINISHED";   // someone reached WIN_SCORE

export interface ArenaDuel {
  aId: string;
  bId: string;
  gameDefId: string;
  matchId: string; // unique per duel — used by client to detect and drop stale events
}

export interface RoundDuel extends ArenaDuel {
  gameMeta: GameMeta;
}

export interface GameMeta {
  gameDefId: string;
  displayName: { en: string; ar: string };
  instructions: { en: string; ar: string };
  durationMs: number;
}

export interface ArenaState {
  phase: ArenaPhase;
  /** The duel the *receiving client* is participating in. Null if benched. */
  duel: ArenaDuel | null;
  /** All concurrent duels in the current round (populated during PRE_ROUND and DUELING). */
  duels: RoundDuel[];
  benchedId: string | null;
  gameId: number;
  startedAt: number | null;
  endsAt: number | null;
  /** Epoch ms when the 3-2-1 countdown started (set when both players ready, before DUELING). Null otherwise. */
  countdownStartAt: number | null;
  gameMeta: GameMeta | null; // set during PRE_ROUND, kept through DUELING (for the player's own duel)
  lastResult: DuelResultBroadcast | null;
  lastGameResult: GameResultPayload | null;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
}

// ── Game plugin types ─────────────────────────────────────────────────────────

export interface GameInstructions {
  en: string;
  ar: string;
}

/** Outcome per player: 1 = win, 0.5 = draw, 0 = loss */
export type OutcomeByPlayer = Record<string, number>;

export interface GameResolveResult {
  outcomeByPlayerId: OutcomeByPlayer;
  stats: Record<string, unknown>;
}

export interface GameDefinition<TServer = unknown, TPublic = unknown> {
  id: string;
  displayName: { en: string; ar: string };
  durationMs: number;
  instructions: GameInstructions;
  init(playerIds: string[]): TServer;
  publicState(serverState: TServer): TPublic;
  input(serverState: TServer, playerId: string, payload: unknown): TServer;
  resolve(serverState: TServer): GameResolveResult;
  /** Optional: return per-player private data to emit after each input. Return null to skip. */
  privateUpdate?(serverState: TServer, playerId: string): unknown | null;
  /** Optional: return true when the game should be resolved immediately (replaces EARLY_RESOLVE_GAMES set for games with custom logic). */
  isResolved?(serverState: TServer): boolean;
}

// ── Client -> Server payloads ─────────────────────────────────────────────────

export interface CreateRoomPayload  { name: string }
export interface JoinRoomPayload    { roomCode: string; name: string }
export interface LeaveRoomPayload   { roomCode: string }
export interface ToggleReadyPayload { roomCode: string }
export interface DuelResultPayload  { roomCode: string; winnerId: string | null; isDraw: boolean }
export interface PlayAgainPayload   { roomCode: string }
export interface GameInputPayload   { roomCode: string; payload: unknown }
export interface GameSyncPayload    { roomCode: string; matchId?: string; playerId?: string }

// ── Server -> Client payloads ─────────────────────────────────────────────────

export interface RoomJoinedPayload  { roomCode: string; playerId: string; room: Room }
export interface RoomUpdatePayload  { room: Room }
export interface RoomErrorPayload   { messageKey: string; messageText: string }

export interface ArenaUpdatePayload {
  room: Room;
  arena: ArenaState;
}

export interface MatchScoreSummary {
  aValue?: string | number;
  bValue?: string | number;
  label?: string; // e.g. "hits", "time", "score"
}

export interface MatchAnswerDetails {
  correctAnswer?: string | number;
  aAnswer?: string | number | null;
  bAnswer?: string | number | null;
  showAnswers: boolean; // false for memory_grid
}

export interface MatchResultEntry {
  aId: string;
  aName: string;
  bId: string;
  bName: string;
  winnerId: string | null;
  winnerName: string | null;
  isDraw: boolean;
  gameDefId: string;
  stats: Record<string, unknown>;
  scoreSummary?: MatchScoreSummary;
  answerDetails?: MatchAnswerDetails;
}

export interface DuelResultBroadcast {
  winnerId: string | null;
  isDraw: boolean;
  deltaScores: Record<string, number>;
  leaderboard: LeaderboardEntry[];
  /** All match results for this round (needed by benched players' result screen) */
  matches: MatchResultEntry[];
  /** Player benched this round, if any */
  benchedId: string | null;
}

export interface GameStatePayload {
  roomCode: string;
  matchId: string;
  gameId: number;
  gameDefId: string;
  publicState: unknown;
  remainingMs: number;
}

export interface GameResultPayload {
  roomCode: string;
  matchId: string;
  gameId: number;
  gameDefId: string;
  result: GameResolveResult;
}

export interface GamePrivatePayload {
  matchId: string;
  gameId: number;
  data: unknown;
}

// ── Clock calibration payloads ────────────────────────────────────────────────

export interface ClockPingPayload  { t0_client: number }
export interface ClockPongPayload  { t0_client: number; t1_server: number }

// ── Reconnect payloads ────────────────────────────────────────────────────────

export interface PlayerRejoinPayload    { roomCode: string; playerId: string }
export interface PlayerRejoinAckPayload { playerId: string; room: Room; arena: ArenaState }

// ── Room settings payloads ────────────────────────────────────────────────────

export interface UpdateRoomSettingsPayload { roomCode: string; settings: RoomSettings }
