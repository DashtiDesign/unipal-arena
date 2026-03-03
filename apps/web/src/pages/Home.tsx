import { useEffect, useRef, useState } from "react";
import { T } from "../i18n";
import { socket } from "../socket";
import { EVENTS } from "@arena/shared";
import type { RoomJoinedPayload, RoomErrorPayload, ArenaUpdatePayload } from "@arena/shared";
import type { Session } from "../App";
import { Button, Input, Spinner, Alert } from "@heroui/react";

interface Props {
  t: T;
  onJoined: (session: Session) => void;
}

type View = "menu" | "create" | "join";

function getDeepLinkCode(): string {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("room") ?? "";
  return /^\d{4}$/.test(code) ? code : "";
}

/** Ensures socket is connected, then calls `emit`. Rejects on connect_error or timeout. */
function connectAndEmit(emit: () => void, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      emit();
      resolve();
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
      reject(new Error("timeout"));
    }, timeoutMs);

    function onConnect() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.off("connect_error", onError);
      emit();
      resolve();
    }

    function onError(err: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.off("connect", onConnect);
      reject(err);
    }

    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
    socket.connect();
  });
}

export default function Home({ t, onJoined }: Props) {
  const [view, setView] = useState<View>(() => (getDeepLinkCode() ? "join" : "menu"));
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState(getDeepLinkCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    // Remove any stale listeners from a previous Home mount before attaching new ones
    socket.off(EVENTS.ROOM_JOINED);
    socket.off(EVENTS.ARENA_UPDATE);
    socket.off(EVENTS.ROOM_ERROR);

    // Pre-connect eagerly so the socket is likely ready by the time user submits
    if (!socket.connected) socket.connect();

    let pendingSession: Omit<Session, "arena"> | null = null;

    function onJoinedEvent(payload: RoomJoinedPayload) {
      if (!isMounted.current) return;
      setLoading(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      window.history.replaceState({}, "", url.toString());
      pendingSession = { roomCode: payload.roomCode, playerId: payload.playerId, room: payload.room };
      onJoined({
        ...pendingSession,
        arena: { phase: "LOBBY", duel: null, benchedId: null, gameId: 0, startedAt: null, endsAt: null, countdownStartAt: null, gameMeta: null, lastResult: null, lastGameResult: null },
      });
    }

    function onArenaUpdate(payload: ArenaUpdatePayload) {
      if (pendingSession) {
        onJoined({ ...pendingSession, arena: payload.arena });
        pendingSession = null;
      }
    }

    function onRoomError(payload: RoomErrorPayload) {
      if (!isMounted.current) return;
      setLoading(false);
      const key = payload.messageKey as keyof T;
      setError((t[key] as string | undefined) ?? t.err_unknown);
    }

    // Reconnect when app comes back to foreground (iOS Safari backgrounding drops WS)
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && !socket.connected) {
        socket.connect();
      }
    }

    socket.on(EVENTS.ROOM_JOINED, onJoinedEvent);
    socket.on(EVENTS.ARENA_UPDATE, onArenaUpdate);
    socket.on(EVENTS.ROOM_ERROR, onRoomError);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isMounted.current = false;
      socket.off(EVENTS.ROOM_JOINED, onJoinedEvent);
      socket.off(EVENTS.ARENA_UPDATE, onArenaUpdate);
      socket.off(EVENTS.ROOM_ERROR, onRoomError);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [t, onJoined]);

  async function handleCreate() {
    const name = playerName.trim();
    if (!name) return;
    setError("");
    setLoading(true);
    try {
      await connectAndEmit(() => socket.emit(EVENTS.CREATE_ROOM, { name }));
    } catch {
      if (isMounted.current) {
        setLoading(false);
        setError("Couldn't connect. Try again.");
      }
    }
  }

  async function handleJoin() {
    const name = playerName.trim();
    if (!name || roomCode.length !== 4) return;
    setError("");
    setLoading(true);
    try {
      await connectAndEmit(() => socket.emit(EVENTS.JOIN_ROOM, { name, roomCode }));
    } catch {
      if (isMounted.current) {
        setLoading(false);
        setError("Couldn't connect. Try again.");
      }
    }
  }

  function goTo(v: View) {
    setError("");
    setView(v);
  }

  if (view === "menu") {
    return (
      <main className="px-4 pt-10 pb-8 flex flex-col gap-8 max-w-sm mx-auto">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-extrabold tracking-tight">{t.appName}</h1>
          <p className="text-base text-(--muted)">{t.tagline}</p>
        </div>

        <div className="flex flex-col gap-3">
          <Button variant="primary" fullWidth size="lg" onPress={() => goTo("create")}>{t.createRoom}</Button>
          <Button variant="outline" fullWidth size="lg" onPress={() => goTo("join")}>{t.joinRoom}</Button>
        </div>

        <div className="border-t border-(--border)" />

        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-(--muted)">How it works</h3>
          <ul className="flex flex-col gap-4">
            <li className="flex gap-3 items-start">
              <span className="text-xl shrink-0">🎮</span>
              <span className="text-sm"><strong>10 mini-games</strong> — quick reflex &amp; brain challenges played 1-vs-1</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="text-xl shrink-0">🔄</span>
              <span className="text-sm"><strong>Every player duels every other</strong> — the arena cycles through all matchups</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="text-xl shrink-0">🏅</span>
              <span className="text-sm"><strong>Scoring</strong> — win earns 1 pt, draw earns 0.5 pts, loss earns 0</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="text-xl shrink-0">🪑</span>
              <span className="text-sm"><strong>Odd players?</strong> — one player sits out each round fairly</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="text-xl shrink-0">🏆</span>
              <span className="text-sm"><strong>Champion</strong> — the player with the most points wins</span>
            </li>
          </ul>
        </div>
      </main>
    );
  }

  if (view === "create") {
    return (
      <main className="px-4 pt-6 pb-8 flex flex-col gap-6 max-w-sm mx-auto">
        <Button variant="outline" size="sm" onPress={() => goTo("menu")} className="self-start">
          ← {t.back}
        </Button>
        <h2 className="text-2xl font-bold">{t.createRoom}</h2>
        {error && (
          <Alert status="danger">
            <Alert.Content><Alert.Title>{error}</Alert.Title></Alert.Content>
          </Alert>
        )}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t.playerName}</label>
          <Input
            type="text"
            fullWidth
            className="h-12"
            value={playerName}
            autoFocus
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>
        <Button variant="primary" fullWidth size="lg" isDisabled={!playerName.trim() || loading} onPress={handleCreate}>
          {loading ? <Spinner size="sm" /> : t.create}
        </Button>
      </main>
    );
  }

  // join view — code first, then name
  return (
    <main className="px-4 pt-6 pb-8 flex flex-col gap-6 max-w-sm mx-auto">
      <Button variant="outline" size="sm" onPress={() => goTo("menu")} className="self-start">
        ← {t.back}
      </Button>
      <h2 className="text-2xl font-bold">{t.joinRoom}</h2>
      {error && (
        <Alert status="danger">
          <Alert.Content><Alert.Title>{error}</Alert.Title></Alert.Content>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t.enterCode}</label>
        <Input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          fullWidth
          className="h-12 tracking-widest text-center text-2xl font-mono"
          value={roomCode}
          autoFocus
          onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t.playerName}</label>
        <Input
          type="text"
          fullWidth
          className="h-12"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
        />
      </div>
      <Button variant="primary" fullWidth size="lg" isDisabled={!playerName.trim() || roomCode.length !== 4 || loading} onPress={handleJoin}>
        {loading ? <Spinner size="sm" /> : t.join}
      </Button>
    </main>
  );
}
