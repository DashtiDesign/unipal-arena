import { T } from "../../i18n";
import type { LeaderboardEntry } from "@arena/shared";

interface ResultData {
  winnerId: string | null;
  isDraw: boolean;
  deltaScores: Record<string, number>;
  leaderboard: LeaderboardEntry[];
}

interface Props {
  t: T;
  onLangToggle: () => void;
  playerId: string;
  result: ResultData;
  onLeave: () => void;
}

export default function DuelResult({ t, onLangToggle, playerId, result, onLeave }: Props) {
  const { winnerId, isDraw, deltaScores, leaderboard } = result;

  let headline: string;
  if (isDraw) {
    headline = t.itsDraw;
  } else if (winnerId === playerId) {
    headline = t.youWon;
  } else {
    headline = t.youLost;
  }

  const myDelta = deltaScores[playerId] ?? 0;
  const deltaLabel = myDelta > 0 ? t.pointsEarned.replace("{n}", String(myDelta)) : "";

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

      <main className="flex flex-col items-center justify-center px-4 py-12 gap-6 max-w-sm mx-auto min-h-[70vh]">
        <div className="card w-full bg-base-100 shadow-xl">
          <div className="card-body items-center gap-3 py-10">
            <p className="text-4xl font-bold text-center">{headline}</p>
            {deltaLabel && (
              <span className="badge badge-success badge-lg text-lg">{deltaLabel}</span>
            )}
            <p className="text-sm text-base-content/60 mt-1">{t.nextDuelIn}</p>
          </div>
        </div>

        <div className="card w-full bg-base-100 shadow-xl">
          <div className="card-body gap-2 py-4">
            <h3 className="font-semibold text-base-content/60 uppercase text-xs tracking-widest">{t.players}</h3>
            <ul className="flex flex-col gap-1">
              {leaderboard.map((entry, i) => (
                <li key={entry.id} className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-base-content/40 w-4">{i + 1}.</span>
                    <span className={entry.id === playerId ? "font-bold" : ""}>{entry.name}</span>
                    {deltaScores[entry.id] > 0 && (
                      <span className="text-success text-xs">+{deltaScores[entry.id]}</span>
                    )}
                  </span>
                  <span className="tabular-nums">{entry.score} {t.pts}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}
