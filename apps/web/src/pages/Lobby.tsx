import { useEffect, useState } from "react";
import { T, Lang } from "../i18n";
import { socket } from "../socket";
import { EVENTS } from "@arena/shared";
import type { Room, ArenaState, ArenaUpdatePayload, PlayerRejoinAckPayload } from "@arena/shared";

const SESSION_KEY = "arena_session";
import type { Session } from "../App";
import { Button, Card, Chip, Spinner } from "@heroui/react";
import PreRound from "./arena/PreRound";
import InGame from "./arena/InGame";
import DuelResult from "./arena/DuelResult";
import WinnerScreen from "./arena/WinnerScreen";

interface Props {
  t: T;
  lang: Lang;
  session: Session;
  onSessionUpdate: (room: Room, arena: ArenaState) => void;
  onLeave: () => void;
}

interface ConfirmDialog {
  title: string;
  body: string;
  confirmLabel: string;
}

export default function Lobby({ t, lang, session, onSessionUpdate, onLeave }: Props) {
  const { roomCode, playerId, room, arena } = session;
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null);

  useEffect(() => {
    function onArenaUpdate(payload: ArenaUpdatePayload) {
      if (!payload?.room) return;
      onSessionUpdate(payload.room, payload.arena);
    }
    // Handle reconnect: server confirmed session resume — refresh local state
    function onRejoinAck(payload: PlayerRejoinAckPayload) {
      if (!payload?.room) return;
      onSessionUpdate(payload.room, payload.arena);
    }
    socket.on(EVENTS.ARENA_UPDATE, onArenaUpdate);
    socket.on(EVENTS.PLAYER_REJOIN_ACK, onRejoinAck);
    return () => {
      socket.off(EVENTS.ARENA_UPDATE, onArenaUpdate);
      socket.off(EVENTS.PLAYER_REJOIN_ACK, onRejoinAck);
    };
  }, [onSessionUpdate]);

  function performLeave() {
    // Clear persisted session so reconnect doesn't try to resume this room
    try { localStorage.removeItem(SESSION_KEY); } catch { /* storage unavailable */ }
    socket.emit(EVENTS.LEAVE_ROOM, { roomCode });
    socket.removeAllListeners();
    socket.disconnect();
    onLeave();
  }

  function handleLeave() {
    const isHost = room.players.find((p) => p.id === playerId)?.id === room.hostId;
    const hasOthers = room.players.length > 1;

    if (isHost && hasOthers) {
      setConfirm({
        title: "End room?",
        body: "If you exit as host, the room will close for everyone.",
        confirmLabel: "End room",
      });
    } else {
      setConfirm({
        title: "Leave room?",
        body: "",
        confirmLabel: "Leave",
      });
    }
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

  const exitButton = (
    <button
      className="flex items-center gap-1.5 text-sm font-medium text-(--muted) hover:text-(--foreground) transition-colors py-1 px-2 -ml-2 rounded-lg"
      onClick={handleLeave}
      aria-label="Exit room"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Exit
    </button>
  );

  const confirmOverlay = confirm && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-(--surface) rounded-2xl p-6 flex flex-col gap-4 w-full max-w-xs shadow-xl">
        <h2 className="text-lg font-bold">{confirm.title}</h2>
        {confirm.body && <p className="text-sm text-(--muted)">{confirm.body}</p>}
        <div className="flex flex-col gap-2">
          <Button variant="danger" fullWidth onPress={performLeave}>
            {confirm.confirmLabel}
          </Button>
          <Button variant="outline" fullWidth onPress={() => setConfirm(null)}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  if (arena.phase === "PRE_ROUND") {
    return (
      <>
        {confirmOverlay}
        <PreRound
          t={t}
          lang={lang}
          room={room}
          arena={arena}
          playerId={playerId}
          isReady={isReady}
          onToggleReady={handleToggleReady}
          onLeave={handleLeave}
        />
      </>
    );
  }

  if (arena.phase === "DUELING") {
    return (
      <>
        {confirmOverlay}
        <InGame
          t={t}
          lang={lang}
          room={room}
          arena={arena}
          playerId={playerId}
          roomCode={roomCode}
          onLeave={handleLeave}
        />
      </>
    );
  }

  if (arena.phase === "RESULT" && arena.lastResult) {
    return (
      <>
        {confirmOverlay}
        <DuelResult
          t={t}
          playerId={playerId}
          duelAId={arena.duel?.aId ?? null}
          duelBId={arena.duel?.bId ?? null}
          benchedId={arena.benchedId}
          result={arena.lastResult}
          gameResult={arena.lastGameResult}
          room={room}
          onLeave={handleLeave}
        />
      </>
    );
  }

  if (arena.phase === "FINISHED") {
    const lb = [...room.players].sort((a, b) => b.score - a.score).map(({ id, name, score }) => ({ id, name, score }));
    return (
      <>
        {confirmOverlay}
        <WinnerScreen
          t={t}
          playerId={playerId}
          leaderboard={lb}
          onPlayAgain={handlePlayAgain}
          onLeave={handleLeave}
        />
      </>
    );
  }

  const allReady = room.players.length >= 2 && room.players.every((p) => p.isReady);

  return (
    <>
      {confirmOverlay}
      <main className="flex flex-col items-center px-4 py-6 gap-6 max-w-sm mx-auto">
        <div className="self-start">{exitButton}</div>

        <Card className="w-full">
          <Card.Content className="flex flex-col items-center gap-2 py-6 px-4">
            <p className="text-sm text-(--muted) uppercase tracking-widest">{t.roomCode}</p>
            <p className="text-6xl font-mono font-bold tracking-wider text-(--accent)">{roomCode}</p>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25D366] text-white text-sm font-medium mt-2"
              onClick={shareWhatsApp}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {t.shareWhatsApp}
            </button>
          </Card.Content>
        </Card>

        <Card className="w-full">
          <Card.Content className="flex flex-col gap-3 p-4">
            <h3 className="font-semibold text-(--muted) uppercase text-sm tracking-widest">
              {t.players} ({room.players.length}/12)
            </h3>
            <ul className="flex flex-col gap-1">
              {room.players.map((player) => {
                const isHost = player.id === room.hostId;
                return (
                  <li key={player.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="truncate text-base font-semibold">{player.name}</span>
                      {isHost && (
                        <Chip size="sm" variant="primary" color="accent" className="shrink-0">
                          {t.hostLabel}
                        </Chip>
                      )}
                    </div>
                    <Chip
                      size="sm"
                      variant={player.isReady ? "primary" : "secondary"}
                      color={player.isReady ? "success" : "default"}
                      className="shrink-0"
                    >
                      {player.isReady ? t.ready : t.notReady}
                    </Chip>
                  </li>
                );
              })}
            </ul>
          </Card.Content>
        </Card>

        {allReady ? (
          <div className="flex flex-col items-center gap-1 w-full">
            <Button variant="outline" fullWidth onPress={handleToggleReady}>
              ✓ {t.ready}
            </Button>
            <p className="text-xs text-(--muted) flex items-center gap-1">
              <Spinner size="sm" />
              {t.waitingForPlayers}
            </p>
          </div>
        ) : (
          <Button
            variant={isReady ? "outline" : "primary"}
            fullWidth
            onPress={handleToggleReady}
          >
            {isReady ? `✓ ${t.ready}` : t.ready}
          </Button>
        )}
      </main>
    </>
  );
}
