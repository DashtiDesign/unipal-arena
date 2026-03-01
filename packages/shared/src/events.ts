// Client -> Server
export const CLIENT_EVENTS = {
  CREATE_ROOM: "room:create",
  JOIN_ROOM: "room:join",
  LEAVE_ROOM: "room:leave",
  TOGGLE_READY: "room:toggleReady",
  // Arena
  DUEL_RESULT: "arena:duelResult",
  PLAY_AGAIN: "arena:playAgain",
  // Game
  GAME_INPUT: "game:input",
} as const;

// Server -> Client
export const SERVER_EVENTS = {
  ROOM_JOINED: "room:joined",
  ROOM_UPDATE: "room:update",
  ROOM_ERROR: "room:error",
  // Arena
  ARENA_UPDATE: "arena:update",
  // Game
  GAME_STATE: "game:state",
  GAME_RESULT: "game:result",
} as const;

export const EVENTS = { ...CLIENT_EVENTS, ...SERVER_EVENTS } as const;
export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
