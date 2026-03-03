import { Server } from "socket.io";
import * as http from "http";
import { rooms } from "./state";
import { flushAllToRedis, releaseRoomLock, getRedisClients } from "./redis";

export function registerGracefulShutdown(
  httpServer: http.Server,
  io: Server,
  tickHandle: ReturnType<typeof setInterval>,
): void {
  async function shutdown(signal: string): Promise<void> {
    console.log(`[shutdown] received ${signal}`);

    // 1. Stop the tick loop
    clearInterval(tickHandle);

    // 2. Notify all connected clients to reconnect (they will retry and hit surviving instances)
    io.emit("server:shutdown");

    // 3. Stop accepting new socket connections
    io.close();

    // 4. Persist all in-memory state to Redis before dying
    await flushAllToRedis();

    // 5. Release all room locks so other instances can take ownership
    for (const code of rooms.keys()) {
      await releaseRoomLock(code);
    }

    // 6. Close Redis connections cleanly
    const clients = getRedisClients();
    if (clients) {
      await clients.pub.quit().catch(() => { /* best effort */ });
      await clients.sub.quit().catch(() => { /* best effort */ });
    }

    // 7. Drain HTTP connections then exit cleanly
    httpServer.close(() => {
      console.log("[shutdown] clean exit");
      process.exit(0);
    });

    // 8. Force-kill if drain hangs (Railway gives ~10s before SIGKILL)
    setTimeout(() => {
      console.error("[shutdown] forced exit after timeout");
      process.exit(1);
    }, 10_000);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT",  () => void shutdown("SIGINT"));
}
