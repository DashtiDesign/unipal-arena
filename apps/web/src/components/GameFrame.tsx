import { useCallback, useEffect, useState } from "react";
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
  roomCode, matchId, gameId, gameDefId, playerId, opponentId, lang, durationMs, onRemainingMs,
}: Props) {
  const [publicState, setPublicState] = useState<unknown>(null);
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [privateEvents, setPrivateEvents] = useState<unknown[]>([]);

  // Reset all local game state whenever matchId changes (new duel started)
  useEffect(() => {
    setPublicState(null);
    setRemainingMs(durationMs);
    setPrivateEvents([]);
  }, [matchId, durationMs]);

  const onRemainingMsCb = useCallback((ms: number) => {
    onRemainingMs?.(ms);
  }, [onRemainingMs]);

  useEffect(() => {
    function onState(p: GameStatePayload) {
      // Discard events from a previous or different match
      if (p.matchId !== matchId || p.gameId !== gameId) return;
      setPublicState(p.publicState);
      setRemainingMs(p.remainingMs);
      onRemainingMsCb(p.remainingMs);
    }
    function onPrivate(p: GamePrivatePayload) {
      if (p.matchId !== matchId || p.gameId !== gameId) return;
      setPrivateEvents((prev) => [...prev, p.data]);
    }
    socket.on(EVENTS.GAME_STATE, onState);
    socket.on("game:private", onPrivate);
    return () => {
      socket.off(EVENTS.GAME_STATE, onState);
      socket.off("game:private", onPrivate);
    };
  }, [matchId, gameId, onRemainingMsCb]);

  function sendInput(payload: unknown) {
    socket.emit(EVENTS.GAME_INPUT, { roomCode, payload });
  }

  const entry = GAME_REGISTRY.get(gameDefId);
  const GameComponent = entry?.component;

  return (
    <div className="w-full">
      {/* Countdown bar */}
      <div className="w-full bg-base-300 rounded-full h-2 mb-4">
        <div
          className="bg-primary h-2 rounded-full transition-all"
          style={{ width: `${Math.min(100, (remainingMs / durationMs) * 100)}%` }}
        />
      </div>

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
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}
    </div>
  );
}
