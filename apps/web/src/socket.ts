import { io } from "socket.io-client";

const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? window.location.origin : "http://localhost:3001");

console.log("[socket] SERVER_URL =", SERVER_URL);

export const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ["websocket"],  // WebSocket only — matches server config (Railway hardening)
  timeout: 10000,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 300,
  reconnectionDelayMax: 2000,
});
