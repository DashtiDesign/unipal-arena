import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import { randomUUID } from "crypto";
import {
  EVENTS,
  Player,
  Room,
  CreateRoomPayload,
  JoinRoomPayload,
  LeaveRoomPayload,
  ToggleReadyPayload,
  PlayAgainPayload,
  GameInputPayload,
  GameSyncPayload,
  PlayerRejoinPayload,
  UpdateRoomSettingsPayload,
} from "@arena/shared";
import { REGISTRY } from "./games/registry";
import path from "path";

import {
  rooms, arenas, gameStates, socketRooms,
  playerSockets, socketPlayers, abandonTimers, resolvedDuels,
  benchCounts, lastBenched, gameDecks, socketOf,
} from "./state";
import {
  getRedisClients, acquireRoomLock, loadRoomFromRedis,
  persistRoom, persistArena, persistPlayerSocket,
} from "./redis";
import {
  generateRoomCode, freshArena, broadcastArena, emitRoundUpdate,
  scheduleRound, startRound, handleLeave, registerSocket, deregisterSocket,
  personalDuel, createPlayerId, evictFromPreviousRoom,
  defaultRoomSettings, validateRoomSettings,
} from "./roomManager";
import {
  startDuelGame, resolveDuel, clearAllGameTimers, broadcastGameStateForDuel,
  scheduleBombReBroadcast, startTickLoop,
} from "./gameEngine";
import { registerGracefulShutdown } from "./shutdown";

// Suppress unused-import warnings for startDuelGame (used transitively via roomManager)
void startDuelGame;

// ── Server setup ──────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3001;
const MAX_PLAYERS = 12;
const DEBUG = process.env.DEBUG_LOGS === "1";

const app = express();
app.use(cors());
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));

if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(__dirname, "../../web/dist");
  console.log("[static] serving web from", distPath);
  app.use(express.static(distPath));
  app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
}

const httpServer = createServer(app);
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? false
    : ["http://localhost:5173", "http://127.0.0.1:5173"];

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins },
  transports: ["websocket"],   // WebSocket only — no polling (Railway hardening)
  pingTimeout: 20000,
  pingInterval: 25000,
});

// ── Redis adapter (conditional) ───────────────────────────────────────────────

async function setupRedisAdapter(): Promise<void> {
  if (!process.env.REDIS_URL) {
    console.log("[redis] REDIS_URL not set — running in single-instance mode");
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createAdapter } = require("@socket.io/redis-adapter");
    const clients = getRedisClients()!;
    io.adapter(createAdapter(clients.pub, clients.sub));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { INSTANCE_ID } = require("./redis") as typeof import("./redis");
    console.log(`[redis] adapter attached — INSTANCE_ID=${INSTANCE_ID}`);
  } catch (err) {
    console.error("[redis] adapter setup failed:", err);
  }
}

// ── Constants (local to index; game constants live in roomManager) ────────────

// All games now use isResolved?() or tick-based expiry
const EARLY_RESOLVE_GAMES = new Set<string>([]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Re-join an existing player to a room after reconnect. */
function handleRejoin(socket: Socket, playerId: string, roomCode: string): void {
  const room  = rooms.get(roomCode)!;
  const arena = arenas.get(roomCode)!;
  const player = room.players.find((p) => p.id === playerId);
  if (!player) {
    socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_not_found", messageText: "Player not found." });
    return;
  }

  // Re-associate new socket with existing stable player identity
  const oldSocket = playerSockets.get(playerId);
  if (oldSocket && oldSocket !== socket.id) {
    socketPlayers.delete(oldSocket);
    socketRooms.delete(oldSocket);
  }
  registerSocket(socket.id, playerId, roomCode);
  socket.join(roomCode);
  persistPlayerSocket(playerId, socket.id);

  const playerDuel = personalDuel(arena, playerId);
  socket.emit(EVENTS.PLAYER_REJOIN_ACK, { playerId, room, arena: { ...arena, duel: playerDuel } });

  // If mid-game, send current game state so client resumes without GAME_SYNC polling
  if (arena.phase === "DUELING" && playerDuel) {
    const def   = REGISTRY.get(playerDuel.gameDefId);
    const state = gameStates.get(playerDuel.matchId);
    if (def && state) {
      const remainingMs = arena.endsAt ? Math.max(0, arena.endsAt - Date.now()) : 0;
      socket.emit(EVENTS.GAME_STATE, {
        roomCode,
        matchId: playerDuel.matchId,
        gameId: arena.gameId,
        gameDefId: playerDuel.gameDefId,
        publicState: def.publicState(state),
        remainingMs,
      });
    }
  }
  console.log(`[rejoin] playerId=${playerId} socket=${socket.id} room=${roomCode}`);
}

// ── Socket.IO event handlers ──────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);
  if (DEBUG) {
    socket.onAny((event, payload) => {
      console.log(`[debug:any] event="${event}" payload=${JSON.stringify(payload)}`);
    });
  }

  // ── CREATE_ROOM ──────────────────────────────────────────────────────────────

  socket.on(EVENTS.CREATE_ROOM, async (payload: CreateRoomPayload) => {
    const name = (payload?.name ?? "").trim();
    if (!name) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_name_required", messageText: "Name is required." });
      return;
    }
    evictFromPreviousRoom(socket.id, io);

    const roomCode = generateRoomCode();
    const playerId = createPlayerId();
    const player: Player = { id: playerId, name, isReady: false, score: 0, clockOffsetMs: 0 };
    const room: Room = { id: roomCode, hostId: playerId, players: [player], createdAt: Date.now(), settings: defaultRoomSettings() };

    rooms.set(roomCode, room);
    arenas.set(roomCode, freshArena());
    socket.join(roomCode);
    registerSocket(socket.id, playerId, roomCode);
    await acquireRoomLock(roomCode);
    persistRoom(roomCode, room);

    socket.emit(EVENTS.ROOM_JOINED, { roomCode, playerId, room });
    console.log(`[room:create] socket=${socket.id} playerId=${playerId} room=${roomCode} name="${name}"`);
  });

  // ── JOIN_ROOM ────────────────────────────────────────────────────────────────

  socket.on(EVENTS.JOIN_ROOM, async (payload: JoinRoomPayload) => {
    const name     = (payload?.name ?? "").trim();
    const roomCode = (payload?.roomCode ?? "").trim();
    console.log(`[room:join] socket=${socket.id} attempt roomCode="${roomCode}" exists=${rooms.has(roomCode)}`);

    if (!name) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_name_required", messageText: "Name is required." });
      return;
    }
    if (!/^\d{4}$/.test(roomCode)) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_invalid_code", messageText: "Room code must be 4 digits." });
      return;
    }

    let room  = rooms.get(roomCode);
    let arena = arenas.get(roomCode);

    // Cross-instance recovery: room might be owned by another Railway replica
    if (!room || !arena) {
      const data = await loadRoomFromRedis(roomCode);
      if (data) {
        rooms.set(roomCode, data.room);
        arenas.set(roomCode, data.arena);
        await acquireRoomLock(roomCode);
        room  = data.room;
        arena = data.arena;
        console.log(`[room:join] recovered room=${roomCode} from Redis`);
      }
    }

    if (!room || !arena) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_not_found", messageText: "Room not found." });
      return;
    }
    if (room.players.length >= MAX_PLAYERS) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_full", messageText: "Room is full." });
      return;
    }

    evictFromPreviousRoom(socket.id, io);

    const playerId = createPlayerId();
    const player: Player = { id: playerId, name, isReady: false, score: 0, clockOffsetMs: 0 };
    room.players.push(player);
    socket.join(roomCode);
    registerSocket(socket.id, playerId, roomCode);
    persistRoom(roomCode, room);

    socket.emit(EVENTS.ROOM_JOINED, { roomCode, playerId, room });
    socket.emit(EVENTS.ARENA_UPDATE, { room, arena });
    broadcastArena(roomCode, io);
    console.log(`[room:join] socket=${socket.id} playerId=${playerId} room=${roomCode} name="${name}"`);
  });

  // ── LEAVE_ROOM ───────────────────────────────────────────────────────────────

  socket.on(EVENTS.LEAVE_ROOM, (payload: LeaveRoomPayload) => {
    const playerId = socketPlayers.get(socket.id);
    if (!playerId) return;
    deregisterSocket(socket.id);
    handleLeave(playerId, payload?.roomCode, "explicit", io);
  });

  // ── TOGGLE_READY ─────────────────────────────────────────────────────────────

  socket.on(EVENTS.TOGGLE_READY, (payload: ToggleReadyPayload) => {
    const rc = (payload?.roomCode ?? "").trim();
    const playerId = socketPlayers.get(socket.id);
    if (!playerId || socketRooms.get(socket.id) !== rc) return;

    const room  = rooms.get(rc);
    const arena = arenas.get(rc);
    if (!room || !arena) return;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return;

    if (arena.phase === "LOBBY") {
      player.isReady = !player.isReady;
      const allReady = room.players.length >= 2 && room.players.every((p) => p.isReady);
      if (allReady) {
        benchCounts.delete(room.id);
        lastBenched.delete(room.id);
        scheduleRound(room.id, io);
        return;
      }
      broadcastArena(room.id, io);
      return;
    }

    if (arena.phase === "PRE_ROUND") {
      const inDuel = arena.duels.some((d) => d.aId === playerId || d.bId === playerId);
      if (!inDuel) return;
      player.isReady = true;
      const duelerIds = arena.duels.flatMap((d) => [d.aId, d.bId]);
      const allDuelersReady = duelerIds.every((id) => room.players.find((p) => p.id === id)?.isReady ?? false);
      if (allDuelersReady) { startRound(room.id, io); return; }
      emitRoundUpdate(room.id, io);
    }
  });

  // ── GAME_INPUT ───────────────────────────────────────────────────────────────

  socket.on(EVENTS.GAME_INPUT, (payload: GameInputPayload) => {
    const roomCode = (payload?.roomCode ?? "").trim();
    const playerId = socketPlayers.get(socket.id);
    if (!playerId || socketRooms.get(socket.id) !== roomCode) return;

    const arena = arenas.get(roomCode);
    if (!arena || arena.phase !== "DUELING") return;

    const duel = arena.duels.find((d) => d.aId === playerId || d.bId === playerId);
    if (!duel) return;

    // Guard: duel already resolved (can happen if input races the tick-expiry)
    const resolved = resolvedDuels.get(roomCode);
    if (resolved?.has(duel.matchId)) return;

    const matchId = duel.matchId;
    const def   = REGISTRY.get(duel.gameDefId);
    const state = gameStates.get(matchId);
    if (!def || !state) return;

    // Clock calibration: if client sends clockOffsetMs, update stored value on player.
    // eventServerTime = clientNowMs + player.clockOffsetMs (computed per-input).
    const innerPayload = payload.payload as Record<string, unknown> | null | undefined;
    const room = rooms.get(roomCode);
    const player = room?.players.find((p) => p.id === playerId);
    if (player && typeof innerPayload?.clockOffsetMs === "number") {
      player.clockOffsetMs = innerPayload.clockOffsetMs;
    }
    // Inject server-corrected timestamp into the inner payload for game engines to use.
    let enrichedPayload = innerPayload;
    if (player && typeof innerPayload?.clientNowMs === "number") {
      const eventServerTime = innerPayload.clientNowMs + player.clockOffsetMs;
      const serverNow = Date.now();
      // Anti-cheat: clamp to ±2s of server clock
      const clamped = Math.max(serverNow - 2000, Math.min(serverNow + 2000, eventServerTime));
      enrichedPayload = { ...innerPayload, eventServerTime: clamped };
    }

    const newState = def.input(state, playerId, enrichedPayload ?? payload.payload);
    gameStates.set(matchId, newState);
    broadcastGameStateForDuel(matchId, roomCode, duel, arena.endsAt ?? Date.now(), arena.gameId, io);

    // Bomb re-broadcast scheduling for whack_a_logo
    if (duel.gameDefId === "whack_a_logo") {
      scheduleBombReBroadcast(matchId, roomCode, duel, arena.endsAt ?? Date.now(), arena.gameId, newState, io);
    }

    // Per-player private updates (e.g. higher_lower hints)
    if (def.privateUpdate) {
      for (const id of [duel.aId, duel.bId]) {
        const priv = def.privateUpdate(newState, id);
        if (priv != null) {
          const sid = socketOf(id);
          if (sid) {
            io.to(sid).emit(EVENTS.GAME_PRIVATE, {
              matchId,
              gameId: arena.gameId,
              data: priv,
            });
          }
        }
      }
    }

    // Instant-resolve check (e.g. ticTacToe win, higherLower correct guess)
    if (def.isResolved?.(newState)) { resolveDuel(roomCode, duel, io); return; }

    if (EARLY_RESOLVE_GAMES.has(duel.gameDefId)) {
      const result = def.resolve(newState);
      const hasWinner = Object.values(result.outcomeByPlayerId).some((v) => v === 1);
      if (hasWinner) resolveDuel(roomCode, duel, io);
    }
  });

  // ── GAME_SYNC ────────────────────────────────────────────────────────────────

  socket.on(EVENTS.GAME_SYNC, (payload: GameSyncPayload) => {
    const roomCode = (payload?.roomCode ?? "").trim();
    const playerId = socketPlayers.get(socket.id) ?? payload?.playerId;
    const tracked  = socketRooms.get(socket.id);
    if (tracked && tracked !== roomCode) return;

    const room  = rooms.get(roomCode);
    const arena = arenas.get(roomCode);
    console.log(`[game:sync] room=${roomCode} socket=${socket.id} phase=${arena?.phase ?? "none"}`);
    if (!room) return;

    if (arena) {
      if (arena.phase === "PRE_ROUND" || arena.phase === "DUELING") {
        const playerDuel = playerId
          ? (arena.duels.find((d) => d.aId === playerId || d.bId === playerId) ?? null)
          : null;
        socket.emit(EVENTS.ARENA_UPDATE, { room, arena: { ...arena, duel: playerDuel } });
      } else {
        socket.emit(EVENTS.ARENA_UPDATE, { room, arena });
      }
    }

    if (!arena || arena.phase !== "DUELING" || !playerId) return;

    const duel = arena.duels.find((d) => d.aId === playerId || d.bId === playerId);
    if (!duel) return;

    const def   = REGISTRY.get(duel.gameDefId);
    const state = gameStates.get(duel.matchId);
    if (!def || !state) return;

    const remainingMs = arena.endsAt ? Math.max(0, arena.endsAt - Date.now()) : 0;
    console.log(`[game:sync] emitting GAME_STATE room=${roomCode} socket=${socket.id} matchId=${duel.matchId}`);
    socket.emit(EVENTS.GAME_STATE, {
      roomCode,
      matchId: duel.matchId,
      gameId: arena.gameId,
      gameDefId: duel.gameDefId,
      publicState: def.publicState(state),
      remainingMs,
    });
  });

  // ── PLAY_AGAIN ───────────────────────────────────────────────────────────────

  socket.on(EVENTS.PLAY_AGAIN, (payload: PlayAgainPayload) => {
    const rc = (payload?.roomCode ?? "").trim();
    const playerId = socketPlayers.get(socket.id);
    if (!playerId || socketRooms.get(socket.id) !== rc) return;

    const room  = rooms.get(rc);
    const arena = arenas.get(rc);
    if (!room || !arena || arena.phase !== "FINISHED") return;

    for (const p of room.players) { p.score = 0; p.isReady = false; }
    benchCounts.delete(room.id);
    lastBenched.delete(room.id);
    clearAllGameTimers(room.id);
    resolvedDuels.delete(room.id);
    gameDecks.delete(room.id);
    arenas.set(room.id, freshArena());
    broadcastArena(room.id, io);
    persistRoom(room.id, room);
    persistArena(room.id, arenas.get(room.id)!);
  });

  // ── ROOM_SETTINGS_UPDATE ─────────────────────────────────────────────────────

  socket.on(EVENTS.ROOM_SETTINGS_UPDATE, (payload: UpdateRoomSettingsPayload) => {
    const rc = (payload?.roomCode ?? "").trim();
    const playerId = socketPlayers.get(socket.id);
    if (!playerId || socketRooms.get(socket.id) !== rc) return;
    const room  = rooms.get(rc);
    const arena = arenas.get(rc);
    if (!room || !arena || arena.phase !== "LOBBY") return;
    const err = validateRoomSettings(payload?.settings, playerId, room);
    if (err) return;
    room.settings = payload.settings;
    persistRoom(rc, room);
    broadcastArena(rc, io);
  });

  // ── PLAYER_REJOIN ────────────────────────────────────────────────────────────

  socket.on(EVENTS.PLAYER_REJOIN, async (payload: PlayerRejoinPayload) => {
    const { roomCode, playerId } = payload ?? {};
    if (!roomCode || !playerId) return;

    // Cancel any pending abandonment timer for this player
    const pending = abandonTimers.get(playerId);
    if (pending) { clearTimeout(pending); abandonTimers.delete(playerId); }

    let room  = rooms.get(roomCode);
    let arena = arenas.get(roomCode);

    // Cross-instance recovery: try Redis if room not in local memory
    if (!room || !arena) {
      const data = await loadRoomFromRedis(roomCode);
      if (data) {
        rooms.set(roomCode, data.room);
        arenas.set(roomCode, data.arena);
        await acquireRoomLock(roomCode);
        room  = data.room;
        arena = data.arena;
        console.log(`[rejoin] recovered room=${roomCode} from Redis for playerId=${playerId}`);
      }
    }

    if (!room || !arena) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_not_found", messageText: "Room expired." });
      return;
    }

    handleRejoin(socket, playerId, roomCode);
  });

  // ── CLOCK_PING ───────────────────────────────────────────────────────────────
  // Lightweight clock calibration: client sends t0_client, server echoes it back
  // with t1_server. Client computes offset = t1_server - (t0_client + rtt/2).
  // After 3 samples the median offset is stored on the player and used to
  // convert clientNowMs → eventServerTime for timing-sensitive games.

  socket.on(EVENTS.CLOCK_PING, (payload: { t0_client: number; seq?: number; roomCode?: string }) => {
    const t1_server = Date.now();
    socket.emit(EVENTS.CLOCK_PONG, { t0_client: payload.t0_client, t1_server, seq: payload.seq });

    // If this is the final sample (seq === 2), update the player's stored offset
    if (payload.seq === 2 && payload.roomCode) {
      const playerId = socketPlayers.get(socket.id);
      const room = playerId ? rooms.get(payload.roomCode) : null;
      const player = room?.players.find((p) => p.id === playerId);
      if (player) {
        // offset will be re-computed and stored from client via a follow-up GAME_INPUT field;
        // nothing to do server-side here — the offset arrives with each input event.
      }
    }
  });

  // ── disconnect ───────────────────────────────────────────────────────────────

  socket.on("disconnect", (reason) => {
    const playerId = socketPlayers.get(socket.id);
    console.log(`[disconnect] socket=${socket.id} playerId=${playerId ?? "none"} reason=${reason}`);

    const { roomCode } = deregisterSocket(socket.id);

    if (!playerId) return;

    // 60s grace window before eviction — allows mid-game reconnect to resume session
    const t = setTimeout(() => {
      abandonTimers.delete(playerId);
      handleLeave(playerId, roomCode, "disconnect", io);
    }, 60_000);
    abandonTimers.set(playerId, t);
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await setupRedisAdapter();

  const tickHandle = startTickLoop(io);
  registerGracefulShutdown(httpServer, io, tickHandle);

  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

void main().catch((err: unknown) => {
  console.error("[startup] fatal:", err);
  process.exit(1);
});
