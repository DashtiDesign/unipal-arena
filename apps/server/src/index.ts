import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import { randomUUID } from "crypto";
import {
  EVENTS,
  Room,
  Player,
  ArenaState,
  LeaderboardEntry,
  CreateRoomPayload,
  JoinRoomPayload,
  LeaveRoomPayload,
  ToggleReadyPayload,
  PlayAgainPayload,
  GameInputPayload,
  GameSyncPayload,
} from "@arena/shared";
import { REGISTRY, nextFromDeck, freshDeck } from "./games/registry";
import { bombExpiresIn } from "./games/whackALogo";

import path from "path";

const PORT = Number(process.env.PORT) || 3001;
const MAX_PLAYERS = 12;
const WIN_SCORE = 10;
const RESULT_DELAY_MS = 10000;
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
    ? false // same-origin; static files are served from this process
    : ["http://localhost:5173", "http://127.0.0.1:5173"];
const io = new Server(httpServer, { cors: { origin: allowedOrigins } });

// ── State maps ───────────────────────────────────────────────────────────────

const rooms      = new Map<string, Room>();
const arenas     = new Map<string, ArenaState>();
const benchIdx   = new Map<string, number>();
const gameDecks  = new Map<string, string[]>(); // per-room shuffled game deck
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gameStates = new Map<string, any>();
const gameTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Per-room per-player bomb expiry timers: key = `${roomCode}:${playerId}`
const bombTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Reverse map: socketId → roomCode for O(1) lookup + cross-join isolation
const socketRooms = new Map<string, string>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function freshArena(): ArenaState {
  return { phase: "LOBBY", duel: null, benchedId: null, gameId: 0, startedAt: null, endsAt: null, countdownStartAt: null, gameMeta: null, lastResult: null, lastGameResult: null };
}

/** Evict a socket from its current room before joining a new one. Prevents cross-join stale state. */
function evictFromPreviousRoom(socket: Socket) {
  const prev = socketRooms.get(socket.id);
  if (prev) {
    console.log(`[evict] socket=${socket.id} leaving previous room=${prev}`);
    socket.leave(prev);
    socketRooms.delete(socket.id);
    handleLeave(socket.id, prev, "evict");
  }
}

function generateRoomCode(): string {
  let code: string;
  do { code = String(Math.floor(Math.random() * 10000)).padStart(4, "0"); }
  while (rooms.has(code));
  return code;
}

function leaderboard(room: Room): LeaderboardEntry[] {
  return [...room.players].sort((a, b) => b.score - a.score)
    .map(({ id, name, score }) => ({ id, name, score }));
}

function broadcastArena(roomCode: string) {
  const room  = rooms.get(roomCode);
  const arena = arenas.get(roomCode);
  if (room && arena) io.to(roomCode).emit(EVENTS.ARENA_UPDATE, { room, arena });
}

function broadcastGameState(roomCode: string) {
  const arena = arenas.get(roomCode);
  if (!arena?.duel) return;
  const def   = REGISTRY.get(arena.duel.gameDefId);
  const state = gameStates.get(roomCode);
  if (!def || !state) return;
  const remainingMs = arena.endsAt ? Math.max(0, arena.endsAt - Date.now()) : 0;
  // Emit to the whole Socket.IO room — matchId lets clients discard stale events
  io.to(roomCode).emit(EVENTS.GAME_STATE, {
    roomCode,
    matchId: arena.duel.matchId,
    gameId: arena.gameId,
    gameDefId: arena.duel.gameDefId,
    publicState: def.publicState(state),
    remainingMs,
  });
}

function clearGameTimer(roomCode: string) {
  const t = gameTimers.get(roomCode);
  if (t) { clearTimeout(t); gameTimers.delete(roomCode); }
  // Clear any pending bomb-expiry timers for this room
  for (const key of [...bombTimers.keys()]) {
    if (key.startsWith(`${roomCode}:`)) {
      clearTimeout(bombTimers.get(key));
      bombTimers.delete(key);
    }
  }
}

// Games that auto-resolve when a winner is found before time expires (v===1 check)
// All games with "wait for both" or custom logic use isResolved?() on GameDefinition instead
// All games now use isResolved?() or run to timer expiry — nothing needs the early-resolve speculative check
const EARLY_RESOLVE_GAMES = new Set<string>([
  // reaction_green — moved to isResolved?()
  // quick_maths, emoji_odd_one_out, memory_grid — wait for both players, use isResolved?()
  // higher_lower, rock_paper_scissors, tic_tac_toe — use isResolved?()
  // whack_a_logo, tapping_speed, stop_at_10s — run to time expiry
]);

function resolveGame(roomCode: string) {
  clearGameTimer(roomCode);
  const room  = rooms.get(roomCode);
  const arena = arenas.get(roomCode);
  if (!room || !arena || !arena.duel) return;

  const def   = REGISTRY.get(arena.duel.gameDefId);
  const state = gameStates.get(roomCode);
  if (!def || !state) return;

  const result = def.resolve(state);
  gameStates.delete(roomCode);

  io.to(roomCode).emit(EVENTS.GAME_RESULT, {
    roomCode,
    matchId: arena.duel.matchId,
    gameId: arena.gameId,
    gameDefId: arena.duel.gameDefId,
    result,
  });

  const { aId, bId } = arena.duel;
  const deltaScores: Record<string, number> = { [aId]: 0, [bId]: 0 };
  for (const [id, outcome] of Object.entries(result.outcomeByPlayerId)) {
    deltaScores[id] = outcome as number;
  }
  for (const p of room.players) {
    if (p.id in deltaScores) p.score += deltaScores[p.id];
  }

  const topOutcome = Math.max(...Object.values(result.outcomeByPlayerId) as number[]);
  const arenaWinners = Object.entries(result.outcomeByPlayerId).filter(([, v]) => v === topOutcome);
  const isDraw = arenaWinners.length > 1;
  const winnerId = isDraw ? null : arenaWinners[0][0];

  const lb = leaderboard(room);
  arena.phase = "RESULT";
  arena.lastResult = { winnerId, isDraw, deltaScores, leaderboard: lb };
  arena.lastGameResult = {
    roomCode,
    matchId: arena.duel.matchId,
    gameId: arena.gameId,
    gameDefId: arena.duel.gameDefId,
    result,
  };
  broadcastArena(roomCode);
  // Keep separate events for clients that may catch them
  io.to(roomCode).emit(EVENTS.DUEL_RESULT, { winnerId, isDraw, deltaScores, leaderboard: lb });

  const champion = room.players.find((p) => p.score >= WIN_SCORE);

  // Always show RESULT for RESULT_DELAY_MS — even for the final duel
  const t = setTimeout(() => {
    const r = rooms.get(roomCode);
    const a = arenas.get(roomCode);
    if (!r || !a || a.phase !== "RESULT") return;
    if (champion) {
      a.phase = "FINISHED";
      broadcastArena(roomCode);
    } else {
      scheduleDuel(roomCode);
    }
  }, RESULT_DELAY_MS);
  gameTimers.set(roomCode, t);
}

function scheduleDuel(roomCode: string) {
  const room    = rooms.get(roomCode)!;
  const arena   = arenas.get(roomCode)!;
  const players = room.players;
  if (players.length < 2) return;

  let benchedId: string | null = null;
  if (players.length % 2 !== 0) {
    const prev = benchIdx.get(roomCode) ?? -1;
    const nextBenchPos = (prev + 1) % players.length;
    benchIdx.set(roomCode, nextBenchPos);
    benchedId = players[nextBenchPos].id;
  }

  const duelers = players.filter((p) => p.id !== benchedId);
  const aId = duelers[0].id;
  const bId = duelers[1].id;
  for (const p of players) p.isReady = p.id === benchedId;

  // Pull next game from per-room deck; auto-reshuffles when exhausted
  if (!gameDecks.has(roomCode)) gameDecks.set(roomCode, freshDeck());
  const gameDef = nextFromDeck(gameDecks.get(roomCode)!);

  const matchId = randomUUID();

  arena.phase             = "PRE_ROUND";
  arena.duel              = { aId, bId, gameDefId: gameDef.id, matchId };
  arena.gameMeta          = {
    gameDefId: gameDef.id,
    displayName: gameDef.displayName,
    instructions: gameDef.instructions,
    durationMs: gameDef.durationMs,
  };
  arena.benchedId         = benchedId;
  arena.gameId           += 1;
  arena.startedAt         = null;
  arena.endsAt            = null;
  arena.countdownStartAt  = null;
  arena.lastResult        = null;
  arena.lastGameResult    = null;

  broadcastArena(roomCode);
}

const COUNTDOWN_MS = 3000; // 3-2-1 countdown duration before game starts

function startGame(roomCode: string) {
  const arena = arenas.get(roomCode);
  if (!arena?.duel) return;
  const def = REGISTRY.get(arena.duel.gameDefId);
  if (!def) return;

  // Broadcast the countdown start so clients can display 3-2-1
  arena.countdownStartAt = Date.now();
  broadcastArena(roomCode);

  const t = setTimeout(() => {
    const a = arenas.get(roomCode);
    if (!a?.duel) return;
    const now = Date.now();
    a.phase     = "DUELING";
    a.startedAt = now;
    a.endsAt    = now + def.durationMs;

    const state = def.init([a.duel.aId, a.duel.bId]);
    gameStates.set(roomCode, state);

    // Phase update first, then initial game state immediately
    broadcastArena(roomCode);
    broadcastGameState(roomCode);
    // Re-broadcast after 150ms to reduce mount-race missed events
    setTimeout(() => { broadcastArena(roomCode); broadcastGameState(roomCode); }, 150);

    const gameTimer = setTimeout(() => resolveGame(roomCode), def.durationMs);
    gameTimers.set(roomCode, gameTimer);
  }, COUNTDOWN_MS);
  gameTimers.set(roomCode, t);
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);
  if (DEBUG) {
    socket.onAny((event, payload) => {
      console.log(`[debug:any] event="${event}" payload=${JSON.stringify(payload)}`);
    });
  }

  socket.on(EVENTS.CREATE_ROOM, (payload: CreateRoomPayload) => {
    const name = (payload?.name ?? "").trim();
    if (!name) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_name_required", messageText: "Name is required." });
      return;
    }
    evictFromPreviousRoom(socket);
    const roomCode = generateRoomCode();
    const player: Player = { id: socket.id, name, isReady: false, score: 0 };
    const room: Room = { id: roomCode, hostId: socket.id, players: [player], createdAt: Date.now() };
    rooms.set(roomCode, room);
    arenas.set(roomCode, freshArena());
    socket.join(roomCode);
    socketRooms.set(socket.id, roomCode);
    socket.emit(EVENTS.ROOM_JOINED, { roomCode, playerId: socket.id, room });
    console.log(`[room:create] socket=${socket.id} room=${roomCode} name="${name}" rooms=${Array.from(rooms.keys()).join(",")}`);
  });

  socket.on(EVENTS.JOIN_ROOM, (payload: JoinRoomPayload) => {
    const name     = (payload?.name ?? "").trim();
    const roomCode = (payload?.roomCode ?? "").trim();
    console.log(`[room:join] socket=${socket.id} attempt roomCode="${roomCode}" exists=${rooms.has(roomCode)} knownRooms=${Array.from(rooms.keys()).slice(0, 10).join(",") || "(none)"}`);
    if (!name) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_name_required", messageText: "Name is required." });
      return;
    }
    if (!/^\d{4}$/.test(roomCode)) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_invalid_code", messageText: "Room code must be 4 digits." });
      return;
    }
    const room  = rooms.get(roomCode);
    const arena = arenas.get(roomCode);
    if (!room || !arena) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_not_found", messageText: "Room not found." });
      return;
    }
    if (room.players.length >= MAX_PLAYERS) {
      socket.emit(EVENTS.ROOM_ERROR, { messageKey: "err_full", messageText: "Room is full." });
      return;
    }
    evictFromPreviousRoom(socket);
    const player: Player = { id: socket.id, name, isReady: false, score: 0 };
    room.players.push(player);
    socket.join(roomCode);
    socketRooms.set(socket.id, roomCode);
    socket.emit(EVENTS.ROOM_JOINED, { roomCode, playerId: socket.id, room });
    socket.emit(EVENTS.ARENA_UPDATE, { room, arena });
    broadcastArena(roomCode);
    console.log(`[room:join] socket=${socket.id} room=${roomCode} name="${name}"`);
  });

  socket.on(EVENTS.LEAVE_ROOM, (payload: LeaveRoomPayload) => {
    socketRooms.delete(socket.id);
    handleLeave(socket.id, payload?.roomCode, "explicit");
  });

  socket.on(EVENTS.TOGGLE_READY, (payload: ToggleReadyPayload) => {
    const rc = (payload?.roomCode ?? "").trim();
    if (socketRooms.get(socket.id) !== rc) return; // reject stale / cross-room events
    const room  = rooms.get(rc);
    const arena = arenas.get(rc);
    if (!room || !arena) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    if (arena.phase === "LOBBY") {
      player.isReady = !player.isReady;
      const allReady = room.players.length >= 2 && room.players.every((p) => p.isReady);
      if (allReady) { benchIdx.delete(room.id); scheduleDuel(room.id); return; }
      broadcastArena(room.id);
      return;
    }

    if (arena.phase === "PRE_ROUND") {
      if (!arena.duel) return;
      if (player.id !== arena.duel.aId && player.id !== arena.duel.bId) return;
      player.isReady = true;
      const duelA = room.players.find((p) => p.id === arena.duel!.aId);
      const duelB = room.players.find((p) => p.id === arena.duel!.bId);
      if (duelA?.isReady && duelB?.isReady) { startGame(room.id); return; }
      broadcastArena(room.id);
    }
  });

  socket.on(EVENTS.GAME_INPUT, (payload: GameInputPayload) => {
    const roomCode = (payload?.roomCode ?? "").trim();
    if (socketRooms.get(socket.id) !== roomCode) return; // reject stale / cross-room events
    const arena    = arenas.get(roomCode);
    if (!arena || arena.phase !== "DUELING" || !arena.duel) return;
    if (socket.id !== arena.duel.aId && socket.id !== arena.duel.bId) return;

    const def   = REGISTRY.get(arena.duel.gameDefId);
    const state = gameStates.get(roomCode);
    if (!def || !state) return;

    const newState = def.input(state, socket.id, payload.payload);
    gameStates.set(roomCode, newState);
    broadcastGameState(roomCode);

    // Schedule a re-broadcast when a whack_a_logo bomb expires so all clients see it disappear
    if (arena.duel.gameDefId === "whack_a_logo") {
      for (const pid of [arena.duel.aId, arena.duel.bId]) {
        const timerKey = `${roomCode}:${pid}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const slot = (newState as any).slots?.[pid];
        if (!slot) continue;
        const msUntilExpiry = bombExpiresIn(slot);
        if (msUntilExpiry !== null) {
          const existing = bombTimers.get(timerKey);
          if (existing) clearTimeout(existing);
          bombTimers.set(timerKey, setTimeout(() => {
            bombTimers.delete(timerKey);
            const cur = gameStates.get(roomCode);
            if (!cur) return;
            broadcastGameState(roomCode);
          }, msUntilExpiry + 50)); // +50ms buffer for network jitter
        }
      }
    }

    // Send per-player private updates (e.g. hidden hints in higher_lower)
    if (def.privateUpdate) {
      for (const id of [arena.duel.aId, arena.duel.bId]) {
        const priv = def.privateUpdate(newState, id);
        if (priv != null) {
          io.to(id).emit(EVENTS.GAME_PRIVATE, {
            matchId: arena.duel.matchId,
            gameId: arena.gameId,
            data: priv,
          });
        }
      }
    }

    // Custom resolution check (games with complex logic, e.g. round-based or sub-round games)
    if (def.isResolved?.(newState)) { resolveGame(roomCode); return; }

    // Standard early-resolve for simple winner-detection games
    if (EARLY_RESOLVE_GAMES.has(arena.duel.gameDefId)) {
      const resolved = def.resolve(newState);
      const hasWinner = Object.values(resolved.outcomeByPlayerId).some((v) => v === 1);
      if (hasWinner) resolveGame(roomCode);
    }
  });

  socket.on(EVENTS.GAME_SYNC, (payload: GameSyncPayload) => {
    const roomCode = (payload?.roomCode ?? "").trim();
    // Allow GAME_SYNC even if not in socketRooms (reconnecting client) — but reject if tracked to a DIFFERENT room
    const tracked = socketRooms.get(socket.id);
    if (tracked && tracked !== roomCode) return;
    const room     = rooms.get(roomCode);
    const arena    = arenas.get(roomCode);

    console.log(`[game:sync] room=${roomCode} socket=${socket.id} phase=${arena?.phase ?? "none"} matchId=${arena?.duel?.matchId ?? "none"}`);

    // Room not found — nothing to do
    if (!room) return;

    // Always push current arena so client has the right phase/matchId
    if (arena) socket.emit(EVENTS.ARENA_UPDATE, { room, arena });

    // Only emit game state when actively dueling with a live game state
    if (!arena || arena.phase !== "DUELING" || !arena.duel) return;

    const def   = REGISTRY.get(arena.duel.gameDefId);
    const state = gameStates.get(roomCode);
    if (!def || !state) return;

    const remainingMs = arena.endsAt ? Math.max(0, arena.endsAt - Date.now()) : 0;
    console.log(`[game:sync] emitting GAME_STATE room=${roomCode} socket=${socket.id} matchId=${arena.duel.matchId}`);
    socket.emit(EVENTS.GAME_STATE, {
      roomCode,
      matchId: arena.duel.matchId,
      gameId: arena.gameId,
      gameDefId: arena.duel.gameDefId,
      publicState: def.publicState(state),
      remainingMs,
    });
  });

  socket.on(EVENTS.PLAY_AGAIN, (payload: PlayAgainPayload) => {
    const rc = (payload?.roomCode ?? "").trim();
    if (socketRooms.get(socket.id) !== rc) return; // reject stale / cross-room events
    const room  = rooms.get(rc);
    const arena = arenas.get(rc);
    if (!room || !arena || arena.phase !== "FINISHED") return;
    for (const p of room.players) { p.score = 0; p.isReady = false; }
    benchIdx.delete(room.id);
    clearGameTimer(room.id);
    gameStates.delete(room.id);
    gameDecks.delete(room.id); // reset deck for a fresh shuffle next session
    arenas.set(room.id, freshArena());
    broadcastArena(room.id);
  });

  socket.on("disconnect", () => {
    console.log(`[disconnect] socket=${socket.id} room=${socketRooms.get(socket.id) ?? "none"}`);
    socketRooms.delete(socket.id);
    handleLeave(socket.id);
  });
});

function handleLeave(socketId: string, roomCode?: string, reason: "explicit" | "disconnect" | "evict" = "disconnect") {
  const targets = roomCode
    ? ([rooms.get(roomCode)].filter(Boolean) as Room[])
    : [...rooms.values()];

  for (const room of targets) {
    const idx = room.players.findIndex((p) => p.id === socketId);
    if (idx === -1) continue;
    room.players.splice(idx, 1);
    console.log(`[handleLeave] room=${room.id} socket=${socketId} reason=${reason}`);

    if (room.players.length === 0) {
      rooms.delete(room.id);
      arenas.delete(room.id);
      benchIdx.delete(room.id);
      gameDecks.delete(room.id);
      clearGameTimer(room.id);
      gameStates.delete(room.id);
    } else {
      if (room.hostId === socketId) room.hostId = room.players[0].id;
      const arena = arenas.get(room.id)!;
      if (arena.phase === "PRE_ROUND" || arena.phase === "DUELING") {
        const duelIds = [arena.duel?.aId, arena.duel?.bId];
        if (duelIds.includes(socketId)) {
          console.log(`[handleLeave] duel reset — room=${room.id} socket=${socketId} was dueling`);
          clearGameTimer(room.id);
          gameStates.delete(room.id);
          for (const p of room.players) p.isReady = false;
          arenas.set(room.id, { ...freshArena(), gameId: arena.gameId });
        }
      }
      broadcastArena(room.id);
    }
    break;
  }
}

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
