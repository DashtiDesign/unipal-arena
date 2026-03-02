import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { EVENTS } from "@arena/shared";
import type { GameStatePayload, GamePrivatePayload } from "@arena/shared";
import { GAME_REGISTRY } from "../games/index";
import { Lang } from "../i18n";

interface Props {
  roomCode: string;
  matchId: string;   // unique per duel — used to reset state and ignore stale events
  gameId: number;
  gameDefId: string;
  playerId: string;
  opponentId: string;
  lang: Lang;
  durationMs: number;
  onRemainingMs?: (ms: number) => void;
}

export default function GameFrame({
  roomCode, matchId, gameDefId, playerId, opponentId, lang, durationMs, onRemainingMs,
}: Props) {
  const [publicState, setPublicState] = useState<unknown>(null);
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [privateEvents, setPrivateEvents] = useState<unknown[]>([]);
  const publicStateRef = useRef<unknown>(null);

  // Reset all local game state and request a snapshot whenever matchId changes.
  // Watchdog: poll every 300ms (up to 10 times) until a matching GAME_STATE arrives.
  useEffect(() => {
    setPublicState(null);
    publicStateRef.current = null;
    setRemainingMs(durationMs);
    setPrivateEvents([]);
    socket.emit(EVENTS.GAME_SYNC, { roomCode, matchId });

    let tries = 0;
    const interval = setInterval(() => {
      if (publicStateRef.current !== null) { clearInterval(interval); return; }
      tries += 1;
      if (tries >= 10) { clearInterval(interval); return; }
      socket.emit(EVENTS.GAME_SYNC, { roomCode, matchId });
    }, 300);

    return () => { clearInterval(interval); };
  }, [matchId, durationMs, roomCode]);

  const onRemainingMsCb = useCallback((ms: number) => {
    onRemainingMs?.(ms);
  }, [onRemainingMs]);

  useEffect(() => {
    function onState(p: GameStatePayload) {
      if (p.matchId !== matchId) return;
      publicStateRef.current = p.publicState;
      setPublicState(p.publicState);
      setRemainingMs(p.remainingMs);
      onRemainingMsCb(p.remainingMs);
    }
    function onPrivate(p: GamePrivatePayload) {
      if (p.matchId !== matchId) return;
      setPrivateEvents((prev) => [...prev, p.data]);
    }
    socket.on(EVENTS.GAME_STATE, onState);
    socket.on(EVENTS.GAME_PRIVATE, onPrivate);
    return () => {
      socket.off(EVENTS.GAME_STATE, onState);
      socket.off(EVENTS.GAME_PRIVATE, onPrivate);
    };
  }, [matchId, onRemainingMsCb]);

  function sendInput(payload: unknown) {
    socket.emit(EVENTS.GAME_INPUT, { roomCode, payload });
  }

  const entry = GAME_REGISTRY.get(gameDefId);
  const GameComponent = entry?.component;

  // stop_at_10s has its own built-in timer display — hide the generic bar
  const showProgressBar = gameDefId !== "stop_at_10s";

  return (
    <div className="w-full">
      {/* Countdown bar — hidden for games that render their own timer */}
      {showProgressBar && (
        <div className="w-full bg-base-300 rounded-full h-2 mb-4">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${Math.min(100, (remainingMs / durationMs) * 100)}%` }}
          />
        </div>
      )}

      {publicState !== null && GameComponent ? (
        <GameComponent
          publicState={publicState}
          playerId={playerId}
          opponentId={opponentId}
          remainingMs={remainingMs}
          onInput={sendInput}
          lang={lang}
          privateState={privateEvents}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-base-content/50">
          <span className="loading loading-spinner loading-lg" />
          <span className="text-sm">Syncing…</span>
        </div>
      )}
    </div>
  );
}
