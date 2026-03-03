import { randomUUID } from "crypto";
import type { Room, ArenaState } from "@arena/shared";
import { rooms, arenas, gameStates } from "./state";

// ── Instance identity ─────────────────────────────────────────────────────────

export const INSTANCE_ID: string =
  process.env.RAILWAY_REPLICA_ID ?? randomUUID();

// ── Connection ────────────────────────────────────────────────────────────────

// Lazily imported so the module loads without ioredis installed (no-Redis dev mode).
// The actual Redis class is only resolved when REDIS_URL is present.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pub: any | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sub: any | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRedisClients(): { pub: any; sub: any } | null {
  if (!process.env.REDIS_URL) return null;
  if (_pub) return { pub: _pub, sub: _sub };
  // Dynamic require so the module loads in dev without ioredis
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Redis = require("ioredis");
  _pub = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: false });
  _sub = _pub.duplicate();
  _pub.on("error", (err: Error) => console.error("[redis:pub]", err.message));
  _sub.on("error", (err: Error) => console.error("[redis:sub]", err.message));
  return { pub: _pub, sub: _sub };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPub(): any | null {
  return getRedisClients()?.pub ?? null;
}

// ── Key schema ────────────────────────────────────────────────────────────────

export const KEYS = {
  room:       (code: string)     => `room:${code}`,
  arena:      (code: string)     => `arena:${code}`,
  game:       (matchId: string)  => `game:${matchId}`,
  player:     (playerId: string) => `player:${playerId}`,  // → socketId
  socketRoom: (socketId: string) => `sr:${socketId}`,
  lock:       (code: string)     => `lock:${code}`,
};

const TTL = 3600; // 1 hour

// ── Fire-and-forget writes ────────────────────────────────────────────────────
// Never block the hot path. All writes are best-effort.

function noop() { /* intentional no-op for .catch() */ }

export function persistRoom(code: string, room: Room): void {
  const pub = getPub();
  if (!pub) return;
  pub.set(KEYS.room(code), JSON.stringify(room), "EX", TTL).catch(noop);
}

export function persistArena(code: string, arena: ArenaState): void {
  const pub = getPub();
  if (!pub) return;
  pub.set(KEYS.arena(code), JSON.stringify(arena), "EX", TTL).catch(noop);
}

export function persistGameState(matchId: string, state: unknown): void {
  const pub = getPub();
  if (!pub) return;
  pub.set(KEYS.game(matchId), JSON.stringify(state), "EX", TTL).catch(noop);
}

export function persistPlayerSocket(playerId: string, socketId: string): void {
  const pub = getPub();
  if (!pub) return;
  pub.set(KEYS.player(playerId), socketId, "EX", TTL).catch(noop);
}

// ── Room lock ─────────────────────────────────────────────────────────────────
// Prevents two instances from concurrently mutating the same room.
// Uses NX (only set if not exists) for atomic acquisition.

export async function acquireRoomLock(code: string): Promise<boolean> {
  const pub = getPub();
  if (!pub) return true; // single-instance: always own the room
  const result = await pub.set(KEYS.lock(code), INSTANCE_ID, "NX", "EX", TTL);
  return result === "OK";
}

export async function releaseRoomLock(code: string): Promise<void> {
  const pub = getPub();
  if (!pub) return;
  // Lua CAS: only delete if we own the lock
  await pub.eval(
    `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
    1,
    KEYS.lock(code),
    INSTANCE_ID,
  ).catch(noop);
}

// ── Cross-instance recovery ───────────────────────────────────────────────────
// Called when a PLAYER_REJOIN arrives for a room not in this instance's memory.

export async function loadRoomFromRedis(code: string): Promise<{ room: Room; arena: ArenaState } | null> {
  const pub = getPub();
  if (!pub) return null;
  const [roomJson, arenaJson] = await pub.mget(KEYS.room(code), KEYS.arena(code));
  if (!roomJson || !arenaJson) return null;
  try {
    const room  = JSON.parse(roomJson)  as Room;
    const arena = JSON.parse(arenaJson) as ArenaState;
    return { room, arena };
  } catch {
    return null;
  }
}

// ── Bulk flush (called during graceful shutdown) ──────────────────────────────

export async function flushAllToRedis(): Promise<void> {
  const pub = getPub();
  if (!pub) return;

  const pipeline = pub.pipeline();

  for (const [code, room] of rooms) {
    pipeline.set(KEYS.room(code), JSON.stringify(room), "EX", TTL);
  }
  for (const [code, arena] of arenas) {
    pipeline.set(KEYS.arena(code), JSON.stringify(arena), "EX", TTL);
  }
  for (const [matchId, state] of gameStates) {
    pipeline.set(KEYS.game(matchId), JSON.stringify(state), "EX", TTL);
  }

  await pipeline.exec().catch(noop);
  console.log(`[redis:flush] persisted ${rooms.size} rooms, ${arenas.size} arenas, ${gameStates.size} game states`);
}
