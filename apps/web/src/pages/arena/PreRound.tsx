import { T, Lang } from "../../i18n";
import type { Room, ArenaState } from "@arena/shared";

interface Props {
  t: T;
  lang: Lang;
  onLangToggle: () => void;
  room: Room;
  arena: ArenaState;
  playerId: string;
  isReady: boolean;
  onToggleReady: () => void;
  onLeave: () => void;
}

export default function PreRound({
  t, lang, onLangToggle, room, arena, playerId, isReady, onToggleReady, onLeave,
}: Props) {
  const meta = arena.gameMeta;
  const duel = arena.duel;
  const isBenched = arena.benchedId === playerId;
  const amDueler = duel ? (playerId === duel.aId || playerId === duel.bId) : false;

  const playerA = duel ? room.players.find((p) => p.id === duel.aId) : null;
  const playerB = duel ? room.players.find((p) => p.id === duel.bId) : null;
  const duelLabel = t.duelAnnounce
    .replace("{a}", playerA?.name ?? "?")
    .replace("{b}", playerB?.name ?? "?");

  const instrText = meta
    ? (lang === "ar" ? meta.instructions.ar : meta.instructions.en)
    : "";

  const gameName = meta
    ? (lang === "ar" ? meta.displayName.ar : meta.displayName.en)
    : "";

  return (
    <>
      <div className="navbar bg-base-100 shadow-sm px-4">
        <div className="flex-1">
          <span className="text-xl font-bold tracking-tight">{t.appName}</span>
        </div>
        <div className="flex-none gap-1">
          <button className="btn btn-ghost btn-sm" onClick={onLangToggle}>{t.lang}</button>
          <button className="btn btn-ghost btn-sm text-error" onClick={onLeave}>✕</button>
        </div>
      </div>

      <main className="flex flex-col items-center px-4 py-6 gap-4 max-w-sm mx-auto">
        {/* Duel announcement */}
        <div className="card w-full bg-base-100 shadow-xl">
          <div className="card-body items-center gap-2 py-5">
            <p className="text-xs text-base-content/50 uppercase tracking-widest">🥊 Next Duel</p>
            <p className="text-2xl font-bold text-center">{duelLabel}</p>
            {isBenched && (
              <p className="badge badge-ghost mt-1">{t.benchedThisDuel}</p>
            )}
          </div>
        </div>

        {/* Game info card */}
        {meta && (
          <div className="card w-full bg-primary text-primary-content shadow-xl">
            <div className="card-body gap-3 py-6">
              <p className="text-xs uppercase tracking-widest opacity-70">Game</p>
              <p className="text-3xl font-bold">{gameName}</p>
              <div className="divider my-0 opacity-30" />
              <p className="text-sm leading-relaxed opacity-90">{instrText}</p>
              <p className="text-xs opacity-60">⏱ {meta.durationMs / 1000}s</p>
            </div>
          </div>
        )}

        {/* Ready button — only for duelers */}
        {amDueler && !isBenched && (
          !isReady ? (
            <button className="btn btn-success btn-block btn-lg" onClick={onToggleReady}>
              {t.ready}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2 w-full">
              <span className="badge badge-success badge-lg py-3 px-6">✓ {t.ready}</span>
              <p className="text-sm text-base-content/50">{t.waitingForOpponent}</p>
            </div>
          )
        )}

        {/* Leaderboard */}
        <div className="card w-full bg-base-100 shadow-xl">
          <div className="card-body gap-2 py-4">
            <h3 className="font-semibold text-base-content/60 uppercase text-xs tracking-widest">{t.players}</h3>
            <ul className="flex flex-col gap-1">
              {[...room.players].sort((a, b) => b.score - a.score).map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span className={p.id === playerId ? "font-bold" : ""}>{p.name}</span>
                  <span className="tabular-nums">{p.score} {t.pts}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}
