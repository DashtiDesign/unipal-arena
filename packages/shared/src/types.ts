export interface Player {
  id: string;
  name: string;
  isReady: boolean;
  score: number;
}

export interface Room {
  id: string; // 4-digit string e.g. "0472"
  hostId: string;
  players: Player[];
  createdAt: number;
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

export interface GameMeta {
  gameDefId: string;
  displayName: { en: string; ar: string };
  instructions: { en: string; ar: string };
  durationMs: number;
}

export interface ArenaState {
  phase: ArenaPhase;
  duel: ArenaDuel | null;
  benchedId: string | null;
  gameId: number;
  startedAt: number | null;
  endsAt: number | null;
  gameMeta: GameMeta | null; // set during PRE_ROUND, kept through DUELING
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

// ── Server -> Client payloads ─────────────────────────────────────────────────

export interface RoomJoinedPayload  { roomCode: string; playerId: string; room: Room }
export interface RoomUpdatePayload  { room: Room }
export interface RoomErrorPayload   { messageKey: string; messageText: string }

export interface ArenaUpdatePayload {
  room: Room;
  arena: ArenaState;
}

export interface DuelResultBroadcast {
  winnerId: string | null;
  isDraw: boolean;
  deltaScores: Record<string, number>;
  leaderboard: LeaderboardEntry[];
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
