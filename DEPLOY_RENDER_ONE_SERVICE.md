# Deploy to Render — Single Web Service

One Render Web Service serves both the Socket.IO server and the built React frontend.

## Steps

1. Push this repo to GitHub (or GitLab).
2. Go to [Render](https://render.com) → **New** → **Web Service** → connect your repo.
3. Set the following:

| Field | Value |
|---|---|
| **Environment** | Node |
| **Build Command** | `pnpm install && pnpm --filter shared build && pnpm --filter server build && pnpm --filter web build` |
| **Start Command** | `pnpm --filter server start` |

4. Add one **Environment Variable**:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |

Render automatically injects `PORT`; the server reads it via `process.env.PORT`.

## How it works

- The server (`apps/server/dist/index.js`) starts on Render's assigned port.
- In production it serves the compiled frontend from `apps/web/dist` as static files.
- Any path not matched by the API or static files returns `index.html` (SPA fallback).
- Socket.IO connects to the same origin — no separate server URL needed in the client.

## Notes

- **Free tier**: the service sleeps after ~15 min of inactivity. The first request after sleep takes ~30 s to wake. All in-memory room state is lost on restart.
- **Scaling**: all state is in-memory. If you need multiple instances, add a Redis adapter (`socket.io-redis`).
