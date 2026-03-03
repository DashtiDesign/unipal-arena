import type { Room, ArenaState } from "@arena/shared";

// ── Canonical in-memory state ─────────────────────────────────────────────────
// These Maps are the primary read/write path for all hot operations.
// Redis is written fire-and-forget on mutations and read only on recovery.

export const rooms        = new Map<string, Room>();
export const arenas       = new Map<string, ArenaState>();
// Fair bench tracking: benchCounts[roomCode] → Map<playerId, timesbenched>
export const benchCounts  = new Map<string, Map<string, number>>();
// Last benched player per room (enforce "no twice in a row")
export const lastBenched  = new Map<string, string>();
export const gameDecks    = new Map<string, string[]>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const gameStates   = new Map<string, any>();              // keyed by matchId
export const gameTimers   = new Map<string, ReturnType<typeof setTimeout>>(); // keyed by matchId or `round:${roomCode}`
// Per-duel per-player bomb expiry timers: key = `${matchId}:${playerId}`
export const bombTimers   = new Map<string, ReturnType<typeof setTimeout>>();
// Reverse map: socketId → roomCode for O(1) lookup + cross-join isolation
export const socketRooms  = new Map<string, string>();
// Track which matchIds have resolved this round: key = roomCode, value = Set<matchId>
export const resolvedDuels = new Map<string, Set<string>>();

// ── Stable player identity (for reconnect) ────────────────────────────────────
// player.id is a stable UUID assigned at CREATE/JOIN, separate from socket.id.
// playerSockets bridges the stable identity to the current transport socket.

export const playerSockets = new Map<string, string>();  // playerId → socketId
export const socketPlayers = new Map<string, string>();  // socketId → playerId
// Abandonment timers: if no rejoin within 30s, evict player from room
export const abandonTimers = new Map<string, ReturnType<typeof setTimeout>>(); // playerId → timer

/** Get the current socketId for a stable playerId. Used for personalized emits. */
export function socketOf(playerId: string): string | undefined {
  return playerSockets.get(playerId);
}
