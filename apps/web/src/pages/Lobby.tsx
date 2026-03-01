import { useEffect, useState } from "react";
import { T, Lang } from "../i18n";
import { socket } from "../socket";
import { EVENTS } from "@arena/shared";
import type { Room, ArenaState, ArenaUpdatePayload, LeaderboardEntry } from "@arena/shared";
import type { Session } from "../App";
import PreRound from "./arena/PreRound";
import InGame from "./arena/InGame";
import DuelResult from "./arena/DuelResult";
import WinnerScreen from "./arena/WinnerScreen";

interface Props {
  t: T;
  lang: Lang;
  onLangToggle: () => void;
  session: Session;
  onSessionUpdate: (room: Room, arena: ArenaState) => void;
  onLeave: () => void;
}

interface DuelResultData {
  winnerId: string | null;
  isDraw: boolean;
  deltaScores: Record<string, number>;
  leaderboard: LeaderboardEntry[];
}

export default function Lobby({ t, lang, onLangToggle, session, onSessionUpdate, onLeave }: Props) {
  const { roomCode, playerId, room, arena } = session;
  const [lastResult, setLastResult] = useState<DuelResultData | null>(null);

  useEffect(() => {
    function onArenaUpdate(payload: ArenaUpdatePayload) {
      onSessionUpdate(payload.room, payload.arena);
    }
    function onDuelResult(payload: DuelResultData) {
      setLastResult(payload);
    }
    socket.on(EVENTS.ARENA_UPDATE, onArenaUpdate);
    socket.on("duel:result", onDuelResult);
    return () => {
      socket.off(EVENTS.ARENA_UPDATE, onArenaUpdate);
      socket.off("duel:result", onDuelResult);
    };
  }, [onSessionUpdate]);

  function handleLeave() {
    socket.emit(EVENTS.LEAVE_ROOM, { roomCode });
    socket.disconnect();
    onLeave();
  }

  function handleToggleReady() {
    socket.emit(EVENTS.TOGGLE_READY, { roomCode });
  }

  function handlePlayAgain() {
    socket.emit(EVENTS.PLAY_AGAIN, { roomCode });
  }

  function shareWhatsApp() {
    const url = `${window.location.origin}?room=${roomCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(`${t.appName} — ${url}`)}`, "_blank");
  }

  const me = room.players.find((p) => p.id === playerId);
  const isReady = me?.isReady ?? false;

  // ── PRE_ROUND ─────────────────────────────────────────────────────────────
  if (arena.phase === "PRE_ROUND") {
    return (
      <PreRound
        t={t}
        lang={lang}
        onLangToggle={onLangToggle}
        room={room}
        arena={arena}
        playerId={playerId}
        isReady={isReady}
        onToggleReady={handleToggleReady}
        onLeave={handleLeave}
      />
    );
  }

  // ── DUELING ───────────────────────────────────────────────────────────────
  if (arena.phase === "DUELING") {
    return (
      <InGame
        t={t}
        lang={lang}
        onLangToggle={onLangToggle}
        room={room}
        arena={arena}
        playerId={playerId}
        roomCode={roomCode}
        onLeave={handleLeave}
      />
    );
  }

  // ── RESULT ───────────────────────────────────────────────────────────────
  if (arena.phase === "RESULT" && lastResult) {
    return (
      <DuelResult
        t={t}
        onLangToggle={onLangToggle}
        playerId={playerId}
        result={lastResult}
        onLeave={handleLeave}
      />
    );
  }

  // ── FINISHED ─────────────────────────────────────────────────────────────
  if (arena.phase === "FINISHED") {
    const lb = [...room.players].sort((a, b) => b.score - a.score).map(({ id, name, score }) => ({ id, name, score }));
    return (
      <WinnerScreen
        t={t}
        onLangToggle={onLangToggle}
        playerId={playerId}
        leaderboard={lb}
        onPlayAgain={handlePlayAgain}
        onLeave={handleLeave}
      />
    );
  }

  // ── LOBBY (default) ──────────────────────────────────────────────────────
  const allReady = room.players.length >= 2 && room.players.every((p) => p.isReady);

  return (
    <>
      <div className="navbar bg-base-100 shadow-sm px-4">
        <div className="flex-1">
          <span className="text-xl font-bold tracking-tight">{t.appName}</span>
        </div>
        <div className="flex-none gap-1">
          <button className="btn btn-ghost btn-sm" onClick={onLangToggle}>{t.lang}</button>
          <button className="btn btn-ghost btn-sm text-error" onClick={handleLeave}>✕</button>
        </div>
      </div>

      <main className="flex flex-col items-center px-4 py-8 gap-6 max-w-sm mx-auto">
        {/* Room code + share */}
        <div className="card w-full bg-base-100 shadow-xl">
          <div className="card-body items-center gap-2 py-6">
            <p className="text-sm text-base-content/60 uppercase tracking-widest">{t.roomCode}</p>
            <p className="text-6xl font-mono font-bold tracking-wider text-primary">{roomCode}</p>
            <button className="btn btn-success btn-sm gap-2 mt-2" onClick={shareWhatsApp}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {t.shareWhatsApp}
            </button>
          </div>
        </div>

        {/* Players list */}
        <div className="card w-full bg-base-100 shadow-xl">
          <div className="card-body gap-3">
            <h3 className="font-semibold text-base-content/70 uppercase text-xs tracking-widest">
              {t.players} ({room.players.length}/12)
            </h3>
            <ul className="flex flex-col gap-2">
              {room.players.map((player) => {
                const isMe   = player.id === playerId;
                const isHost = player.id === room.hostId;
                return (
                  <li key={player.id} className="flex items-center justify-between gap-2 py-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`badge badge-sm shrink-0 ${player.isReady ? "badge-success" : "badge-ghost"}`} />
                      <span className="truncate font-medium">{player.name}</span>
                      {isMe   && <span className="badge badge-outline badge-xs shrink-0">{t.youLabel}</span>}
                      {isHost && <span className="badge badge-primary badge-xs shrink-0">{t.hostLabel}</span>}
                    </div>
                    <span className={`text-xs shrink-0 ${player.isReady ? "text-success" : "text-base-content/40"}`}>
                      {player.isReady ? t.ready : t.notReady}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Ready / start button */}
        <button
          className={`btn btn-block ${isReady ? "btn-outline btn-success" : "btn-primary"}`}
          disabled={allReady}
          onClick={handleToggleReady}
        >
          {allReady
            ? <><span className="loading loading-spinner loading-sm" /> {t.waitingForPlayers}</>
            : isReady ? `✓ ${t.ready}` : t.ready}
        </button>
      </main>
    </>
  );
}
