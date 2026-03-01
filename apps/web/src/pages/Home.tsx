import { useEffect, useState } from "react";
import { T, Lang } from "../i18n";
import { socket } from "../socket";
import { EVENTS } from "@arena/shared";
import type { RoomJoinedPayload, RoomErrorPayload, ArenaUpdatePayload } from "@arena/shared";
import type { Session } from "../App";

interface Props {
  t: T;
  lang: Lang;
  onLangToggle: () => void;
  onJoined: (session: Session) => void;
}

type View = "menu" | "create" | "join";

function getDeepLinkCode(): string {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("room") ?? "";
  return /^\d{4}$/.test(code) ? code : "";
}

export default function Home({ t, onLangToggle, onJoined }: Props) {
  const [view, setView] = useState<View>(() => (getDeepLinkCode() ? "join" : "menu"));
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState(getDeepLinkCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    socket.connect();

    // room:joined gives us the room but not arena yet; arena:update arrives right after for join
    // For create, server only sends room:joined (arena starts in LOBBY)
    let pendingSession: Omit<Session, "arena"> | null = null;

    function onJoinedEvent(payload: RoomJoinedPayload) {
      setLoading(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      window.history.replaceState({}, "", url.toString());
      pendingSession = { roomCode: payload.roomCode, playerId: payload.playerId, room: payload.room };
      // arena:update may arrive immediately after; if not (creator), use default LOBBY arena
      onJoined({
        ...pendingSession,
        arena: { phase: "LOBBY", duel: null, benchedId: null, gameId: 0, startedAt: null, endsAt: null, gameMeta: null },
      });
    }

    function onArenaUpdate(payload: ArenaUpdatePayload) {
      // If we haven't transitioned yet (joinee receives arena right after room:joined)
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
    <>
      <div className="navbar bg-base-100 shadow-sm px-4">
        <div className="flex-1">
          <span className="text-xl font-bold tracking-tight">{t.appName}</span>
        </div>
        <div className="flex-none">
          <button className="btn btn-ghost btn-sm" onClick={onLangToggle}>
            {t.lang}
          </button>
        </div>
      </div>

      <main className="flex flex-col items-center justify-center px-4 py-12 gap-6">
        {view === "menu" && (
          <>
            <div className="card w-full max-w-sm bg-base-100 shadow-xl">
              <div className="card-body gap-4">
                <h2 className="card-title justify-center text-2xl">{t.appName}</h2>
                <p className="text-center text-base-content/60 text-sm">{t.tagline}</p>
                <div className="divider" />
                <button className="btn btn-primary btn-block" onClick={() => goTo("create")}>
                  {t.createRoom}
                </button>
                <button className="btn btn-outline btn-block" onClick={() => goTo("join")}>
                  {t.joinRoom}
                </button>
              </div>
            </div>

            {/* How it works */}
            <div className="card w-full max-w-sm bg-base-100 shadow-xl">
              <div className="card-body gap-3 py-5">
                <h3 className="font-semibold text-base-content/60 uppercase text-xs tracking-widest">How it works</h3>
                <ul className="flex flex-col gap-3 text-sm">
                  <li className="flex gap-3">
                    <span className="text-xl leading-none">🎮</span>
                    <span><strong>10 mini-games</strong> — quick reflex &amp; brain challenges played 1-vs-1</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-xl leading-none">🔄</span>
                    <span><strong>Every player duels every other</strong> — the arena cycles through all matchups</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-xl leading-none">🏅</span>
                    <span><strong>Scoring</strong> — win earns 1 pt, draw earns 0.5 pts, loss earns 0</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-xl leading-none">🪑</span>
                    <span><strong>Odd players?</strong> — one player sits out each round fairly, rotating so everyone gets equal rest</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-xl leading-none">🏆</span>
                    <span><strong>Champion</strong> — the player with the most points when all duels are done wins</span>
                  </li>
                </ul>
              </div>
            </div>
          </>
        )}

        {view === "create" && (
          <div className="card w-full max-w-sm bg-base-100 shadow-xl">
            <div className="card-body gap-4">
              <h2 className="card-title">{t.createRoom}</h2>
              {error && <div className="alert alert-error text-sm py-2">{error}</div>}
              <label className="form-control w-full">
                <div className="label"><span className="label-text">{t.playerName}</span></div>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={playerName}
                  autoFocus
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </label>
              <div className="card-actions flex-col gap-2">
                <button
                  className="btn btn-primary btn-block"
                  disabled={!playerName.trim() || loading}
                  onClick={handleCreate}
                >
                  {loading ? <span className="loading loading-spinner loading-sm" /> : t.create}
                </button>
                <button className="btn btn-ghost btn-block" onClick={() => goTo("menu")}>←</button>
              </div>
            </div>
          </div>
        )}

        {view === "join" && (
          <div className="card w-full max-w-sm bg-base-100 shadow-xl">
            <div className="card-body gap-4">
              <h2 className="card-title">{t.joinRoom}</h2>
              {error && <div className="alert alert-error text-sm py-2">{error}</div>}
              <label className="form-control w-full">
                <div className="label"><span className="label-text">{t.playerName}</span></div>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={playerName}
                  autoFocus
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </label>
              <label className="form-control w-full">
                <div className="label"><span className="label-text">{t.enterCode}</span></div>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={4}
                  className="input input-bordered w-full tracking-widest text-center text-2xl font-mono"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                />
              </label>
              <div className="card-actions flex-col gap-2">
                <button
                  className="btn btn-primary btn-block"
                  disabled={!playerName.trim() || roomCode.length !== 4 || loading}
                  onClick={handleJoin}
                >
                  {loading ? <span className="loading loading-spinner loading-sm" /> : t.join}
                </button>
                <button className="btn btn-ghost btn-block" onClick={() => goTo("menu")}>←</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
