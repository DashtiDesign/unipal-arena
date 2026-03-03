# Unipal Arena — حلبة يونيبال

A real-time multiplayer party game platform built for mobile. Up to 12 players join a room and face off in head-to-head mini-game duels — one pair at a time, tournament-style. First to 10 points wins.

Fully bilingual: English and Arabic (RTL supported).

---

## Games (10 total)

| Game | Description |
|---|---|
| **Quick Maths** | Pick the correct answer to a maths problem fastest |
| **Tapping Speed** | Tap the button as many times as possible in 15s |
| **Reaction Time** | Tap when the screen turns green — early tap = instant loss |
| **Memory Grid** | Memorize 5 highlighted cells in a 4×4 grid, then tap them from memory |
| **Rock Paper Scissors** | Classic — simultaneous reveal |
| **Higher or Lower** | Guess a secret number 1–100 in as few rounds as possible |
| **Tic-Tac-Toe** | 15s per turn — run out of time and you lose |
| **Odd One Out** | Find the emoji that doesn't belong in a 4×4 grid |
| **Stop at 10s** | Stop a hidden stopwatch as close to 10.000s as possible |
| **Whack a Logo** | Tap the Unipal logo (+1 pt); avoid or tap the bomb (−2 pts) |

Games rotate in a shuffled deck — the same game never plays twice in a row.

---

## Architecture

```
unipal-arena/
├── apps/
│   ├── server/          Node.js + Express + Socket.IO
│   └── web/             React 19 + Vite + Tailwind CSS v4
└── packages/
    └── shared/          Shared TypeScript types and Socket.IO event names
```

**pnpm workspaces** monorepo. `packages/shared` must be built before `server` or `web`.

### Server
- **Socket.IO** over WebSocket-only transport (no polling)
- **Server-authoritative** game state — clients send inputs only; server owns all game logic, scores, and timers
- **20 TPS tick loop** — broadcasts `GAME_STATE` to every active duel every 50ms, handles game expiry
- **Stable player IDs** — `player.id` is a UUID assigned at join, separate from `socket.id`
- **30s reconnect grace** — disconnected players are held for 30s; reconnecting resumes their session
- **Redis** (optional) — when `REDIS_URL` is set, uses `ioredis` + `@socket.io/redis-adapter` for multi-instance fan-out and state persistence. Single-instance mode works without Redis.
- **Room locks** — Redis `SET NX` prevents two instances from owning the same room
- **Graceful shutdown** — SIGTERM flushes state to Redis before exiting

### Client
- **React 19** + **HeroUI v3** component library
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **Clock sync** — client sends `clientNowMs` with every input; server applies a per-player `clockOffsetMs` to compute the authoritative event time
- **PWA-ready** — install hint shown on iOS Safari

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+

### Install

```bash
git clone <repo-url>
cd unipal-arena
pnpm install
```

### Develop

```bash
pnpm dev
```

This starts both the server (`:3001`) and the web dev server (`:5173`) concurrently.

### Build

```bash
pnpm build
```

Builds in order: `shared` → `server` → `web`. Output:
- `apps/server/dist/` — compiled Node.js server
- `apps/web/dist/` — static frontend (served by the server in production)

### Production

The server serves the compiled frontend as static files. Set `NODE_ENV=production` and point the server at the built web dist:

```bash
NODE_ENV=production PORT=3001 node apps/server/dist/index.js
```

The server automatically serves `apps/web/dist` at `/` in production mode.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP server port |
| `NODE_ENV` | — | Set to `production` to serve static frontend |
| `REDIS_URL` | — | Redis connection string (optional; enables multi-instance mode) |
| `RAILWAY_REPLICA_ID` | — | Auto-set by Railway; used as the instance ID for Redis locks |
| `DEBUG_LOGS` | — | Set to `1` to enable verbose server logs |
| `DEBUG_REACTION` | — | Set to `1` to enable Reaction Time timing debug logs |

---

## Deploying to Railway

1. Create a Railway project and connect this repo.
2. Add a **Redis** plugin to the project — Railway sets `REDIS_URL` automatically.
3. Set `NODE_ENV=production` on the server service.
4. Enable **sticky sessions** (session affinity) on the server service if running multiple replicas.
5. Set replica count ≥ 2 if desired — the Redis adapter handles cross-instance Socket.IO fan-out.

The build command for Railway:

```bash
pnpm build
```

The start command:

```bash
node apps/server/dist/index.js
```

---

## Game Flow

```
LOBBY → PRE_ROUND → DUELING → RESULT → (repeat) → FINISHED
```

1. **LOBBY** — Players join via 4-digit room code. Host waits; players toggle ready.
2. **PRE_ROUND** — Game selected from shuffled deck. Each pair sees their opponent and game instructions. A 3-2-1 countdown runs.
3. **DUELING** — All pairs play simultaneously. Server broadcasts game state at 20 TPS. Timer expiry is handled server-side by the tick loop.
4. **RESULT** — Scores updated. Results screen shows: your match breakdown (with correct/wrong answers where applicable), other matches, leaderboard delta.
5. After 10s, the next round starts. Once a player reaches 10 points, the game moves to **FINISHED**.

With an odd number of players, one player is benched each round (fair rotation — no one sits out twice in a row).

---

## Project Structure

```
apps/server/src/
├── index.ts          Socket.IO event handlers (thin orchestrator)
├── state.ts          All in-memory Maps
├── roomManager.ts    Room/player lifecycle, bench selection, round scheduling
├── gameEngine.ts     Tick loop, duel resolution, game state broadcast
├── redis.ts          Redis helpers (fire-and-forget writes, room locks)
├── shutdown.ts       Graceful SIGTERM/SIGINT handler
└── games/
    ├── registry.ts   Shuffled deck + game lookup
    ├── quickMaths.ts
    ├── tappingSpeed.ts
    ├── reactionGreen.ts
    ├── memoryGrid.ts
    ├── rockPaperScissors.ts
    ├── higherLower.ts
    ├── ticTacToe.ts
    ├── emojiOddOneOut.ts
    ├── stopAt10s.ts
    └── whackALogo.ts

apps/web/src/
├── App.tsx           Root — session state, language toggle
├── pages/
│   ├── Home.tsx      Create/Join UI, reconnect-on-refresh logic
│   ├── Lobby.tsx     Phase router (LOBBY / PRE_ROUND / DUELING / RESULT / FINISHED)
│   └── arena/
│       ├── PreRound.tsx
│       ├── InGame.tsx       GameFrame + game component
│       ├── DuelResult.tsx   Results screen
│       └── WinnerScreen.tsx
└── games/
    ├── index.ts      Client-side game registry (id → React component)
    ├── QuickMaths.tsx
    ├── TappingSpeed.tsx
    ├── ReactionGreen.tsx
    ├── MemoryGrid.tsx
    ├── RockPaperScissors.tsx
    ├── HigherLower.tsx
    ├── TicTacToe.tsx
    ├── EmojiOddOneOut.tsx
    ├── StopAt10s.tsx
    └── WhackALogo.tsx

packages/shared/src/
├── types.ts          All shared TypeScript interfaces
└── events.ts         Socket.IO event name constants
```

---

## Adding a New Game

1. **Server**: Create `apps/server/src/games/yourGame.ts` implementing the `GameDefinition<TServer, TPublic>` interface from `@arena/shared`. Add it to `apps/server/src/games/registry.ts`.

2. **Client**: Create `apps/web/src/games/YourGame.tsx` accepting `GameComponentProps`. Add it to `apps/web/src/games/index.ts`.

3. **Results**: Add a `case "your_game_id"` to `buildBreakdown` in `apps/web/src/pages/arena/DuelResult.tsx` and to `extractMatchMeta` in `apps/server/src/gameEngine.ts`.

The `GameDefinition` interface requires:

```typescript
interface GameDefinition<TServer, TPublic> {
  id: string;
  displayName: { en: string; ar: string };
  durationMs: number;
  instructions: { en: string; ar: string };
  init(playerIds: string[]): TServer;
  publicState(serverState: TServer): TPublic;
  input(serverState: TServer, playerId: string, payload: unknown): TServer;
  resolve(serverState: TServer): GameResolveResult;
  isResolved?(serverState: TServer): boolean;  // optional early-resolve hook
  privateUpdate?(serverState: TServer, playerId: string): unknown | null;
}
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Server framework | Express + Socket.IO 4 |
| Frontend | React 19 + Vite 5 |
| UI components | HeroUI v3 |
| Styling | Tailwind CSS v4 |
| Language | TypeScript 5 throughout |
| Package manager | pnpm workspaces |
| Persistence | Redis (ioredis) — optional |
| Deployment | Railway |
