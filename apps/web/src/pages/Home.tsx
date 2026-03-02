import { useEffect, useState } from "react";
import { T } from "../i18n";
import { socket } from "../socket";
import { EVENTS } from "@arena/shared";
import type { RoomJoinedPayload, RoomErrorPayload, ArenaUpdatePayload } from "@arena/shared";
import type { Session } from "../App";
import { Button, Card, Input, Spinner, Alert } from "@heroui/react";

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

export default function Home({ t, onJoined }: Props) {
  const [view, setView] = useState<View>(() => (getDeepLinkCode() ? "join" : "menu"));
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState(getDeepLinkCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    socket.connect();
    let pendingSession: Omit<Session, "arena"> | null = null;

    function onJoinedEvent(payload: RoomJoinedPayload) {
      setLoading(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      window.history.replaceState({}, "", url.toString());
      pendingSession = { roomCode: payload.roomCode, playerId: payload.playerId, room: payload.room };
      onJoined({
        ...pendingSession,
        arena: { phase: "LOBBY", duel: null, benchedId: null, gameId: 0, startedAt: null, endsAt: null, gameMeta: null, lastResult: null, lastGameResult: null },
      });
    }

    function onArenaUpdate(payload: ArenaUpdatePayload) {
      if (pendingSession) {
        onJoined({ ...pendingSession, arena: payload.arena });
        pendingSession = null;
      }
    }

    function onError(payload: RoomErrorPayload) {
      setLoading(false);
      const key = payload.messageKey as keyof T;
      setError((t[key] as string | undefined) ?? t.err_unknown);
    }

    socket.on(EVENTS.ROOM_JOINED, onJoinedEvent);
    socket.on(EVENTS.ARENA_UPDATE, onArenaUpdate);
    socket.on(EVENTS.ROOM_ERROR, onError);
    return () => {
      socket.off(EVENTS.ROOM_JOINED, onJoinedEvent);
      socket.off(EVENTS.ARENA_UPDATE, onArenaUpdate);
      socket.off(EVENTS.ROOM_ERROR, onError);
    };
  }, [t, onJoined]);

  function handleCreate() {
    if (!playerName.trim()) return;
    setError("");
    setLoading(true);
    socket.emit(EVENTS.CREATE_ROOM, { name: playerName.trim() });
  }

  function handleJoin() {
    if (!playerName.trim() || roomCode.length !== 4) return;
    setError("");
    setLoading(true);
    socket.emit(EVENTS.JOIN_ROOM, { name: playerName.trim(), roomCode });
  }

  function goTo(v: View) {
    setError("");
    setView(v);
  }

  return (
    <main className="flex flex-col items-center justify-center px-4 py-12 gap-6">
      {view === "menu" && (
        <>
          <Card className="w-full max-w-sm">
            <Card.Content className="flex flex-col gap-4 p-6">
              <h2 className="text-2xl font-bold text-center">{t.appName}</h2>
              <p className="text-center text-(--muted) text-sm">{t.tagline}</p>
              <hr className="border-(--separator)" />
              <Button variant="primary" fullWidth onPress={() => goTo("create")}>{t.createRoom}</Button>
              <Button variant="outline" fullWidth onPress={() => goTo("join")}>{t.joinRoom}</Button>
            </Card.Content>
          </Card>

          <Card className="w-full max-w-sm">
            <Card.Content className="flex flex-col gap-3 p-6">
              <h3 className="font-semibold text-(--muted) uppercase text-xs tracking-widest">How it works</h3>
              <ul className="flex flex-col gap-3 text-sm">
                <li className="flex gap-3"><span className="text-xl">🎮</span><span><strong>10 mini-games</strong> — quick reflex &amp; brain challenges played 1-vs-1</span></li>
                <li className="flex gap-3"><span className="text-xl">🔄</span><span><strong>Every player duels every other</strong> — the arena cycles through all matchups</span></li>
                <li className="flex gap-3"><span className="text-xl">🏅</span><span><strong>Scoring</strong> — win earns 1 pt, draw earns 0.5 pts, loss earns 0</span></li>
                <li className="flex gap-3"><span className="text-xl">🪑</span><span><strong>Odd players?</strong> — one player sits out each round fairly</span></li>
                <li className="flex gap-3"><span className="text-xl">🏆</span><span><strong>Champion</strong> — the player with the most points wins</span></li>
              </ul>
            </Card.Content>
          </Card>
        </>
      )}

      {view === "create" && (
        <Card className="w-full max-w-sm">
          <Card.Content className="flex flex-col gap-4 p-6">
            <h2 className="text-xl font-bold">{t.createRoom}</h2>
            {error && <Alert status="danger"><Alert.Content><Alert.Title>{error}</Alert.Title></Alert.Content></Alert>}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t.playerName}</label>
              <Input type="text" fullWidth value={playerName} autoFocus onChange={(e) => setPlayerName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="primary" fullWidth isDisabled={!playerName.trim() || loading} onPress={handleCreate}>
                {loading ? <Spinner size="sm" /> : t.create}
              </Button>
              <Button variant="ghost" fullWidth onPress={() => goTo("menu")}>←</Button>
            </div>
          </Card.Content>
        </Card>
      )}

      {view === "join" && (
        <Card className="w-full max-w-sm">
          <Card.Content className="flex flex-col gap-4 p-6">
            <h2 className="text-xl font-bold">{t.joinRoom}</h2>
            {error && <Alert status="danger"><Alert.Content><Alert.Title>{error}</Alert.Title></Alert.Content></Alert>}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t.playerName}</label>
              <Input type="text" fullWidth value={playerName} autoFocus onChange={(e) => setPlayerName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t.enterCode}</label>
              <Input type="tel" inputMode="numeric" pattern="\d*" maxLength={4} fullWidth className="tracking-widest text-center text-2xl font-mono" value={roomCode} onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={(e) => e.key === "Enter" && handleJoin()} />
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="primary" fullWidth isDisabled={!playerName.trim() || roomCode.length !== 4 || loading} onPress={handleJoin}>
                {loading ? <Spinner size="sm" /> : t.join}
              </Button>
              <Button variant="ghost" fullWidth onPress={() => goTo("menu")}>←</Button>
            </div>
          </Card.Content>
        </Card>
      )}
    </main>
  );
}
