import { T } from "../../i18n";
import type { LeaderboardEntry, Room, GameResultPayload } from "@arena/shared";

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
  gameResult: GameResultPayload | null;
  room: Room;
  onLeave: () => void;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtMs(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const rem = Math.round(ms % 1000);
  return `${s}.${String(rem).padStart(3, "0")}s`;
}

function playerName(room: Room, id: string): string {
  return room.players.find((p) => p.id === id)?.name ?? id.slice(0, 6);
}

// ── Per-game breakdown ────────────────────────────────────────────────────────

interface Row { label: string; value: string; winner: boolean }
interface Breakdown { rows: Row[]; reason: string }

function buildBreakdown(
  gameDefId: string,
  stats: Record<string, unknown>,
  playerId: string,
  opponentId: string,
  winnerId: string | null,
  isDraw: boolean,
  room: Room,
): Breakdown | null {
  const myName  = playerName(room, playerId);
  const oppName = playerName(room, opponentId);
  const iWon    = winnerId === playerId;
  const oppWon  = winnerId === opponentId;

  switch (gameDefId) {

    case "rock_paper_scissors": {
      const finalChoices = stats.finalChoices as Record<string, string> | null | undefined;
      const myChoice  = finalChoices?.[playerId]  ?? null;
      const oppChoice = finalChoices?.[opponentId] ?? null;
      const LABEL: Record<string, string> = { rock: "🪨 Rock", paper: "📄 Paper", scissors: "✂️ Scissors" };
      const BEATS: Record<string, string> = { rock: "scissors", scissors: "paper", paper: "rock" };
      const cl = (c: string | null) => (c ? (LABEL[c] ?? c) : "—");
      let reason: string;
      if (isDraw) {
        reason = myChoice ? `Both picked ${cl(myChoice)} — draw` : "Draw";
      } else if (myChoice && oppChoice) {
        const winChoice = iWon ? myChoice : oppChoice;
        const loseChoice = iWon ? oppChoice : myChoice;
        const winName = iWon ? myName : oppName;
        reason = BEATS[winChoice] === loseChoice
          ? `${winName}'s ${cl(winChoice)} beats ${cl(loseChoice)}`
          : iWon ? "You win!" : `${oppName} wins`;
      } else {
        reason = iWon ? "You win!" : `${oppName} wins`;
      }
      return {
        rows: [
          { label: myName,  value: cl(myChoice),  winner: iWon  && !isDraw },
          { label: oppName, value: cl(oppChoice), winner: oppWon && !isDraw },
        ],
        reason,
      };
    }

    case "tapping_speed": {
      const taps = stats.taps as Record<string, number> | undefined;
      const myTaps  = taps?.[playerId]  ?? 0;
      const oppTaps = taps?.[opponentId] ?? 0;
      return {
        rows: [
          { label: myName,  value: `${myTaps} taps`,  winner: iWon  && !isDraw },
          { label: oppName, value: `${oppTaps} taps`, winner: oppWon && !isDraw },
        ],
        reason: isDraw ? "Same taps — draw" : iWon ? "More taps" : `${oppName} had more taps`,
      };
    }

    case "stop_at_10s": {
      type StopResult = { elapsedMs: number | null; diffMs: number };
      const results = stats.results as Record<string, StopResult> | undefined;
      const mine = results?.[playerId];
      const opp  = results?.[opponentId];
      const fmtStop = (r: StopResult | undefined) => {
        if (!r || r.elapsedMs == null) return "No stop";
        const diff = r.diffMs >= 0 ? fmtMs(r.diffMs) : "—";
        return `${fmtMs(r.elapsedMs)} (Δ ${diff})`;
      };
      return {
        rows: [
          { label: myName,  value: fmtStop(mine), winner: iWon  && !isDraw },
          { label: oppName, value: fmtStop(opp),  winner: oppWon && !isDraw },
        ],
        reason: isDraw
          ? "Same distance from 10.000s — draw"
          : iWon ? "Closer to 10.000s" : `${oppName} was closer to 10.000s`,
      };
    }

    case "reaction_green": {
      type ReactResult = { early: boolean; elapsedMs: number | null };
      const results = stats.results as Record<string, ReactResult> | undefined;
      const mine = results?.[playerId];
      const opp  = results?.[opponentId];
      const fmtR = (r: ReactResult | undefined) => {
        if (!r) return "—";
        if (r.early) return "Too fast ⚡";
        if (r.elapsedMs == null) return "No tap";
        return fmtMs(r.elapsedMs);
      };
      let reason: string;
      if (isDraw) {
        reason = (mine?.early && opp?.early) ? "Both tapped too early — draw" : "Same reaction time — draw";
      } else if (mine?.early && !opp?.early) {
        reason = "You tapped too early";
      } else if (!mine?.early && opp?.early) {
        reason = "Opponent tapped too early";
      } else if (iWon && opp?.elapsedMs == null) {
        reason = "Opponent did not respond";
      } else if (oppWon && mine?.elapsedMs == null) {
        reason = "You did not respond";
      } else {
        reason = iWon ? `${myName} reacted faster` : `${oppName} reacted faster`;
      }
      return {
        rows: [
          { label: myName,  value: fmtR(mine), winner: iWon  && !isDraw },
          { label: oppName, value: fmtR(opp),  winner: oppWon && !isDraw },
        ],
        reason,
      };
    }

    case "quick_maths":
    case "emoji_odd_one_out":
    case "memory_grid": {
      type CRResult = { correct: boolean; elapsedMs: number };
      const results = stats.results as Record<string, CRResult> | undefined;
      const mine = results?.[playerId];
      const opp  = results?.[opponentId];
      const fmtRow = (r: CRResult | undefined) => {
        if (!r) return "—";
        return r.correct ? `✓ Correct · ${fmtMs(r.elapsedMs)}` : "✗ Wrong";
      };
      const myCorrect  = mine?.correct ?? false;
      const oppCorrect = opp?.correct  ?? false;
      let reason: string;
      if (isDraw) {
        reason = (!myCorrect && !oppCorrect) ? "Both answers were wrong — draw" : "Same speed — draw";
      } else if (iWon) {
        reason = !oppCorrect
          ? "Opponent's answer was wrong"
          : `${myName} answered faster (${fmtMs(mine?.elapsedMs)} vs ${fmtMs(opp?.elapsedMs)})`;
      } else {
        reason = !myCorrect
          ? "Your answer was wrong"
          : `${oppName} answered faster (${fmtMs(opp?.elapsedMs)} vs ${fmtMs(mine?.elapsedMs)})`;
      }
      return {
        rows: [
          { label: myName,  value: fmtRow(mine), winner: iWon  && !isDraw },
          { label: oppName, value: fmtRow(opp),  winner: oppWon && !isDraw },
        ],
        reason,
      };
    }

    case "tic_tac_toe": {
      const timedOut  = stats.timedOut as string | null | undefined;
      const winnerStat = stats.winner  as string | null | undefined;
      const drawStat   = stats.isDraw  as boolean | undefined;
      let reason: string;
      if (drawStat) {
        reason = "Board full — draw";
      } else if (timedOut) {
        reason = `${playerName(room, timedOut)} ran out of time`;
      } else if (winnerStat) {
        reason = `${playerName(room, winnerStat)} got 3 in a row`;
      } else {
        reason = isDraw ? "Draw" : iWon ? "3 in a row" : `${oppName} got 3 in a row`;
      }
      return {
        rows: [
          { label: myName,  value: iWon ? "🏆 Winner" : isDraw ? "Draw" : "—", winner: iWon  && !isDraw },
          { label: oppName, value: oppWon ? "🏆 Winner" : isDraw ? "Draw" : "—", winner: oppWon && !isDraw },
        ],
        reason,
      };
    }

    case "higher_lower": {
      const rounds = stats.rounds as number | undefined;
      const secret = stats.secret as number | undefined;
      const winnerName = iWon ? myName : oppName;
      const reason = isDraw
        ? "Both guessed in the same round — draw"
        : `${winnerName} guessed the number${secret != null ? ` (${secret})` : ""}${rounds != null ? ` in ${rounds} round${rounds !== 1 ? "s" : ""}` : ""}`;
      return {
        rows: [
          { label: myName,  value: iWon ? "✓ Guessed it!" : "—", winner: iWon  && !isDraw },
          { label: oppName, value: oppWon ? "✓ Guessed it!" : "—", winner: oppWon && !isDraw },
        ],
        reason,
      };
    }

    case "whack_a_logo": {
      const hits = stats.hits as Record<string, number> | undefined;
      const myHits  = hits?.[playerId]  ?? 0;
      const oppHits = hits?.[opponentId] ?? 0;
      return {
        rows: [
          { label: myName,  value: `${myHits} hits`,  winner: iWon  && !isDraw },
          { label: oppName, value: `${oppHits} hits`, winner: oppWon && !isDraw },
        ],
        reason: isDraw ? "Same hits — draw" : iWon ? "More hits" : `${oppName} had more hits`,
      };
    }

    default:
      return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DuelResult({ t, onLangToggle, playerId, result, gameResult, room, onLeave }: Props) {
  const { winnerId, isDraw, deltaScores, leaderboard } = result;

  const opponentId = leaderboard.find((e) => e.id !== playerId)?.id ?? "";

  const headline = isDraw ? t.itsDraw : winnerId === playerId ? t.youWon : t.youLost;
  const myDelta = deltaScores[playerId] ?? 0;
  const deltaLabel = myDelta > 0 ? t.pointsEarned.replace("{n}", String(myDelta)) : "";

  const breakdown = gameResult
    ? buildBreakdown(
        gameResult.gameDefId,
        gameResult.result.stats as Record<string, unknown>,
        playerId,
        opponentId,
        winnerId,
        isDraw,
        room,
      )
    : null;

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

      <main className="flex flex-col items-center px-4 py-8 gap-4 max-w-sm mx-auto">
        {/* Headline */}
        <div className="card w-full bg-base-100 shadow-xl">
          <div className="card-body items-center gap-2 py-8">
            <p className="text-5xl">{isDraw ? "🤝" : winnerId === playerId ? "🏆" : "😢"}</p>
            <p className="text-2xl font-bold text-center">{headline}</p>
            {deltaLabel && (
              <span className="badge badge-success badge-lg text-base mt-1">{deltaLabel}</span>
            )}
          </div>
        </div>

        {/* Per-game breakdown */}
        {breakdown && (
          <div className="card w-full bg-base-100 shadow-xl">
            <div className="card-body gap-3 py-5">
              <h3 className="font-semibold text-base-content/60 uppercase text-xs tracking-widest">Result</h3>
              <div className="flex flex-col gap-2">
                {breakdown.rows.map((row) => (
                  <div
                    key={row.label}
                    className={[
                      "flex items-center justify-between rounded-xl px-4 py-3",
                      row.winner ? "bg-success/15 border border-success/30" : "bg-base-200",
                    ].join(" ")}
                  >
                    <span className={`font-semibold text-sm truncate mr-2 ${row.winner ? "text-success" : ""}`}>
                      {row.label}{row.winner && " 🏆"}
                    </span>
                    <span className={`text-sm tabular-nums shrink-0 ${row.winner ? "font-bold text-success" : "text-base-content/70"}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-base-content/50 text-center pt-1">{breakdown.reason}</p>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="card w-full bg-base-100 shadow-xl">
          <div className="card-body gap-2 py-4">
            <h3 className="font-semibold text-base-content/60 uppercase text-xs tracking-widest">{t.players}</h3>
            <ul className="flex flex-col gap-1">
              {leaderboard.map((entry, i) => (
                <li key={entry.id} className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-base-content/40 w-4">{i + 1}.</span>
                    <span className={entry.id === playerId ? "font-bold" : ""}>{entry.name}</span>
                    {(deltaScores[entry.id] ?? 0) > 0 && (
                      <span className="text-success text-xs">+{deltaScores[entry.id]}</span>
                    )}
                  </span>
                  <span className="tabular-nums">{entry.score} {t.pts}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-xs text-base-content/30">{t.nextDuelIn}</p>
      </main>
    </>
  );
}
