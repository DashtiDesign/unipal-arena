import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { EVENTS } from "@arena/shared";
import type { GameStatePayload, GamePrivatePayload, ClockPongPayload } from "@arena/shared";
import { GAME_REGISTRY } from "../games/index";
import { Lang } from "../i18n";
import { Spinner } from "@heroui/react";

interface Props {
  roomCode: string;
  matchId: string;
  gameId: number;
  gameDefId: string;
  playerId: string;
  opponentId: string;
  lang: Lang;
  durationMs: number;
  onRemainingMs?: (ms: number) => void;
}

/** Run 3 CLOCK_PING samples and return the median offset (server - client midpoint). */
function runClockCalibration(roomCode: string): Promise<number> {
  return new Promise((resolve) => {
    const samples: number[] = [];
    const SAMPLES = 3;

    function sendPing(seq: number) {
      socket.emit(EVENTS.CLOCK_PING, { t0_client: Date.now(), seq, roomCode });
    }

    function onPong(p: ClockPongPayload & { seq?: number }) {
      const t2_client = Date.now();
      const rtt = t2_client - p.t0_client;
      const offset = p.t1_server - (p.t0_client + rtt / 2);
      samples.push(offset);

      if (samples.length < SAMPLES) {
        sendPing(samples.length);
      } else {
        socket.off(EVENTS.CLOCK_PONG, onPong);
        const sorted = [...samples].sort((a, b) => a - b);
        resolve(sorted[Math.floor(SAMPLES / 2)]); // median
      }
    }

    socket.on(EVENTS.CLOCK_PONG, onPong);
    sendPing(0);

    // Timeout fallback — resolve with 0 if calibration stalls
    setTimeout(() => {
      if (samples.length < SAMPLES) {
        socket.off(EVENTS.CLOCK_PONG, onPong);
        const sorted = [...samples].sort((a, b) => a - b);
        resolve(sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0);
      }
    }, 3000);
  });
}

export default function GameFrame({
  roomCode, matchId, gameDefId, playerId, opponentId, lang, durationMs, onRemainingMs,
}: Props) {
  const [publicState, setPublicState] = useState<unknown>(null);
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [privateEvents, setPrivateEvents] = useState<unknown[]>([]);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const publicStateRef = useRef<unknown>(null);
  const clockOffsetRef = useRef(0);

  // Clock calibration — run on every new match
  useEffect(() => {
    let cancelled = false;
    runClockCalibration(roomCode).then((offset) => {
      if (!cancelled) {
        clockOffsetRef.current = offset;
        setClockOffsetMs(offset);
      }
    });
    return () => { cancelled = true; };
  }, [matchId, roomCode]);

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
    // Always include clockOffsetMs so server can update the stored offset per input
    const enriched = (payload && typeof payload === "object")
      ? { ...(payload as Record<string, unknown>), clockOffsetMs: clockOffsetRef.current }
      : payload;
    socket.emit(EVENTS.GAME_INPUT, { roomCode, payload: enriched });
  }

  const entry = GAME_REGISTRY.get(gameDefId);
  const GameComponent = entry?.component;

  const showProgressBar = gameDefId !== "stop_at_10s";

  return (
    <div className="w-full" dir="ltr">
      {showProgressBar && (
        <div className="w-full bg-(--surface-secondary) rounded-full h-2 mb-4">
          <div
            className="bg-(--accent) h-2 rounded-full transition-all"
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
          clockOffsetMs={clockOffsetMs}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-(--muted)">
          <Spinner size="lg" />
          <span className="text-sm">Syncing…</span>
        </div>
      )}
    </div>
  );
}
