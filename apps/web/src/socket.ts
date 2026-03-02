import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? window.location.origin;

export const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  upgrade: true,
  timeout: 10000,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 300,
  reconnectionDelayMax: 2000,
});
