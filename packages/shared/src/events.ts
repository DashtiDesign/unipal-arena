// Client -> Server
export const CLIENT_EVENTS = {
  CREATE_ROOM: "room:create",
  JOIN_ROOM: "room:join",
  LEAVE_ROOM: "room:leave",
  TOGGLE_READY: "room:toggleReady",
  // Arena
  PLAY_AGAIN: "arena:playAgain",
  // Game
  GAME_INPUT: "game:input",
  GAME_SYNC: "game:sync",
} as const;

// Server -> Client
export const SERVER_EVENTS = {
  ROOM_JOINED: "room:joined",
  ROOM_UPDATE: "room:update",
  ROOM_ERROR: "room:error",
  // Arena
  ARENA_UPDATE: "arena:update",
  DUEL_RESULT: "duel:result",
  // Game
  GAME_STATE: "game:state",
  GAME_RESULT: "game:result",
  GAME_PRIVATE: "game:private",
} as const;

export const EVENTS = { ...CLIENT_EVENTS, ...SERVER_EVENTS } as const;
export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
