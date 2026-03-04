import { T } from "../../i18n";
import type { LeaderboardEntry, MatchResultEntry } from "@arena/shared";
import { Card, Chip } from "@heroui/react";

interface ResultData {
  winnerId: string | null;
  isDraw: boolean;
  deltaScores: Record<string, number>;
  leaderboard: LeaderboardEntry[];
  matches: MatchResultEntry[];
  benchedId: string | null;
}

interface Props {
  t: T;
  playerId: string;
  benchedId: string | null;
  result: ResultData;
  onLeave: () => void;
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return "—";
  return `${Math.floor(ms / 1000)}.${String(Math.round(ms % 1000)).padStart(3, "0")}s`;
}

// ── Per-game breakdown row builder ────────────────────────────────────────────

interface Row { label: string; value: string; winner: boolean }
interface BreakdownCard { rows: Row[]; reason: string; answerBlock?: React.ReactNode }

function buildBreakdown(match: MatchResultEntry, myId: string): BreakdownCard | null {
  const { gameDefId, stats, aId, aName, bId, bName, winnerId, isDraw, answerDetails } = match;
  const amA = myId === aId;
  const myName    = amA ? aName : bName;
  const oppName   = amA ? bName : aName;
  const myIdUsed  = amA ? aId  : bId;
  const oppIdUsed = amA ? bId  : aId;
  const iWon   = winnerId === myIdUsed;
  const oppWon = winnerId === oppIdUsed;

  type CRResult = { correct: boolean; elapsedMs: number };

  switch (gameDefId) {
    case "rock_paper_scissors": {
      const fc = stats.finalChoices as Record<string, string> | null | undefined;
      const myC  = fc?.[myIdUsed]  ?? null;
      const oppC = fc?.[oppIdUsed] ?? null;
      const LABEL: Record<string, string> = { rock: "🪨 Rock", paper: "📄 Paper", scissors: "✂️ Scissors" };
      const BEATS: Record<string, string> = { rock: "scissors", scissors: "paper", paper: "rock" };
      const cl = (c: string | null) => c ? (LABEL[c] ?? c) : "—";
      let reason: string;
      if (isDraw) { reason = myC ? `Both picked ${cl(myC)} — draw` : "Draw"; }
      else if (myC && oppC) {
        const winChoice = iWon ? myC : oppC;
        const loseChoice = iWon ? oppC : myC;
        const winName = iWon ? myName : oppName;
        reason = BEATS[winChoice] === loseChoice ? `${winName}'s ${cl(winChoice)} beats ${cl(loseChoice)}` : iWon ? "You win!" : `${oppName} wins`;
      } else { reason = iWon ? "You win!" : `${oppName} wins`; }
      return { rows: [{ label: myName, value: cl(myC), winner: iWon && !isDraw }, { label: oppName, value: cl(oppC), winner: oppWon && !isDraw }], reason };
    }

    case "tapping_speed": {
      const taps = stats.taps as Record<string, number> | undefined;
      const myTaps  = taps?.[myIdUsed]  ?? 0;
      const oppTaps = taps?.[oppIdUsed] ?? 0;
      return {
        rows: [{ label: myName, value: `${myTaps} taps`, winner: iWon && !isDraw }, { label: oppName, value: `${oppTaps} taps`, winner: oppWon && !isDraw }],
        reason: isDraw ? "Same taps — draw" : iWon ? "More taps" : `${oppName} had more taps`,
      };
    }

    case "stop_at_10s": {
      type SResult = { elapsedMs: number | null; diffMs: number };
      const results = stats.results as Record<string, SResult> | undefined;
      const mine = results?.[myIdUsed]; const opp = results?.[oppIdUsed];
      const fmtStop = (r: SResult | undefined) => {
        if (!r || r.elapsedMs == null) return "No stop";
        const label = r.elapsedMs > 10000 ? `${fmtMs(r.diffMs)} above` : r.elapsedMs < 10000 ? `${fmtMs(r.diffMs)} below` : "exact";
        return `${fmtMs(r.elapsedMs)} · ${label}`;
      };
      return {
        rows: [{ label: myName, value: fmtStop(mine), winner: iWon && !isDraw }, { label: oppName, value: fmtStop(opp), winner: oppWon && !isDraw }],
        reason: isDraw ? "Same distance from 10.000s — draw" : iWon ? "Closer to 10.000s" : `${oppName} was closer to 10.000s`,
      };
    }

    case "reaction_green": {
      type RResult = { early: boolean; elapsedMs: number | null };
      const results = stats.results as Record<string, RResult> | undefined;
      const mine = results?.[myIdUsed]; const opp = results?.[oppIdUsed];
      const fmtR = (r: RResult | undefined) => {
        if (!r) return "—";
        if (r.early) return "Too fast ⚡";
        if (r.elapsedMs == null) return "No tap";
        return fmtMs(r.elapsedMs);
      };
      let reason: string;
      if (isDraw) { reason = (mine?.early && opp?.early) ? "Both tapped too early — draw" : "Same reaction time — draw"; }
      else if (mine?.early && !opp?.early) { reason = "You tapped too early"; }
      else if (!mine?.early && opp?.early) { reason = "Opponent tapped too early"; }
      else if (iWon && opp?.elapsedMs == null) { reason = "Opponent did not respond"; }
      else if (oppWon && mine?.elapsedMs == null) { reason = "You did not respond"; }
      else { reason = iWon ? `${myName} reacted faster` : `${oppName} reacted faster`; }

      // Reaction time display chips from client-measured displayMs
      const myDisplayMs = amA ? answerDetails?.aAnswer : answerDetails?.bAnswer;
      const oppDisplayMs = amA ? answerDetails?.bAnswer : answerDetails?.aAnswer;
      const fmtChip = (v: string | number | null | undefined) => {
        if (v == null) return null;
        const n = Number(v);
        if (isNaN(n) || n < 0) return null;
        return n >= 1000 ? `${(n / 1000).toFixed(3)}s` : `${n} ms`;
      };
      const myChip = mine?.early ? null : fmtChip(myDisplayMs);
      const oppChip = opp?.early ? null : fmtChip(oppDisplayMs);
      const reactionBlock = (myChip || oppChip) ? (
        <div className="mt-3 flex gap-2 flex-wrap">
          {myChip && (
            <Chip color={iWon ? "success" : "default"} variant="soft" size="md">
              {myName}: {myChip}
            </Chip>
          )}
          {oppChip && (
            <Chip color={oppWon ? "success" : "default"} variant="soft" size="md">
              {oppName}: {oppChip}
            </Chip>
          )}
        </div>
      ) : undefined;

      return { rows: [{ label: myName, value: fmtR(mine), winner: iWon && !isDraw }, { label: oppName, value: fmtR(opp), winner: oppWon && !isDraw }], reason, answerBlock: reactionBlock };
    }

    case "quick_maths": {
      const results = stats.results as Record<string, CRResult> | undefined;
      const answer  = stats.answer  as number | undefined;
      const mine = results?.[myIdUsed]; const opp = results?.[oppIdUsed];
      const fmtRow = (r: CRResult | undefined) => r ? (r.correct ? `✓ ${fmtMs(r.elapsedMs)}` : "✗ Wrong") : "—";
      let reason: string;
      if (isDraw) { reason = (!mine?.correct && !opp?.correct) ? "Both answers wrong — draw" : "Same speed — draw"; }
      else if (iWon) { reason = !opp?.correct ? "Opponent answered wrong" : `${myName} answered faster`; }
      else { reason = !mine?.correct ? "Your answer was wrong" : `${oppName} answered faster`; }

      const myChoice = amA ? answerDetails?.aAnswer : answerDetails?.bAnswer;
      const answerBlock = (
        <div className="mt-3 flex flex-col gap-1">
          {!mine?.correct && myChoice != null && (
            <span className="text-(--danger) font-semibold text-base">Your answer: {myChoice}</span>
          )}
          {answer != null && (
            <span className="text-(--success) font-semibold text-base">Correct answer: {answer}</span>
          )}
        </div>
      );
      return { rows: [{ label: myName, value: fmtRow(mine), winner: iWon && !isDraw }, { label: oppName, value: fmtRow(opp), winner: oppWon && !isDraw }], reason, answerBlock };
    }

    case "emoji_odd_one_out": {
      const results = stats.results as Record<string, CRResult> | undefined;
      const mine = results?.[myIdUsed]; const opp = results?.[oppIdUsed];
      const fmtRow = (r: CRResult | undefined) => r ? (r.correct ? `✓ ${fmtMs(r.elapsedMs)}` : "✗ Wrong") : "—";
      let reason: string;
      if (isDraw) { reason = (!mine?.correct && !opp?.correct) ? "Both answers wrong — draw" : "Same speed — draw"; }
      else if (iWon) { reason = !opp?.correct ? "Opponent selected wrong" : `${myName} found it faster`; }
      else { reason = !mine?.correct ? "You selected wrong" : `${oppName} found it faster`; }
      const oddEmoji = answerDetails?.correctAnswer;
      const answerBlock = !mine?.correct && oddEmoji != null ? (
        <div className="mt-3">
          <span className="text-(--success) font-semibold text-base">The odd one was: {oddEmoji}</span>
        </div>
      ) : undefined;
      return { rows: [{ label: myName, value: fmtRow(mine), winner: iWon && !isDraw }, { label: oppName, value: fmtRow(opp), winner: oppWon && !isDraw }], reason, answerBlock };
    }

    case "memory_grid": {
      // No answer breakdown — memory game never reveals correct grid
      const results = stats.results as Record<string, CRResult> | undefined;
      const mine = results?.[myIdUsed]; const opp = results?.[oppIdUsed];
      const fmtRow = (r: CRResult | undefined) => r ? (r.correct ? `✓ ${fmtMs(r.elapsedMs)}` : "✗ Wrong") : "—";
      let reason: string;
      if (isDraw) { reason = (!mine?.correct && !opp?.correct) ? "Both wrong — draw" : "Same speed — draw"; }
      else if (iWon) { reason = !opp?.correct ? "Opponent chose wrong cells" : `${myName} remembered faster`; }
      else { reason = !mine?.correct ? "You chose wrong cells" : `${oppName} remembered faster`; }
      return { rows: [{ label: myName, value: fmtRow(mine), winner: iWon && !isDraw }, { label: oppName, value: fmtRow(opp), winner: oppWon && !isDraw }], reason };
    }

    case "tic_tac_toe": {
      const timedOut   = stats.timedOut   as string | null | undefined;
      const winnerStat = stats.winner     as string | null | undefined;
      let reason: string;
      if (stats.isDraw) { reason = "Board full — draw"; }
      else if (timedOut === myIdUsed) { reason = "You ran out of time"; }
      else if (timedOut === oppIdUsed) { reason = `${oppName} ran out of time`; }
      else if (winnerStat) { reason = winnerStat === myIdUsed ? "You got 3 in a row" : `${oppName} got 3 in a row`; }
      else { reason = isDraw ? "Draw" : iWon ? "3 in a row" : `${oppName} got 3 in a row`; }
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
      const answerBlock = secret != null ? (
        <div className="mt-3">
          <span className="text-(--success) font-semibold text-base">Secret number: {secret}</span>
        </div>
      ) : undefined;
      return {
        rows: [{ label: myName, value: iWon ? "✓ Guessed it!" : "—", winner: iWon && !isDraw }, { label: oppName, value: oppWon ? "✓ Guessed it!" : "—", winner: oppWon && !isDraw }],
        reason,
        answerBlock,
      };
    }

    case "whack_a_logo": {
      const hits = stats.hits as Record<string, number> | undefined;
      const myHits  = hits?.[myIdUsed]  ?? 0;
      const oppHits = hits?.[oppIdUsed] ?? 0;
      return {
        rows: [{ label: myName, value: `${myHits} hits`, winner: iWon && !isDraw }, { label: oppName, value: `${oppHits} hits`, winner: oppWon && !isDraw }],
        reason: isDraw ? "Same hits — draw" : iWon ? "More hits" : `${oppName} had more hits`,
      };
    }

    case "paper_toss": {
      const scores = stats.scores as Record<string, number> | undefined;
      const throws = stats.throws as Record<string, number> | undefined;
      const myS  = scores?.[myIdUsed]  ?? 0;
      const oppS = scores?.[oppIdUsed] ?? 0;
      const myT  = throws?.[myIdUsed]  ?? 0;
      const oppT = throws?.[oppIdUsed] ?? 0;
      const wind = stats.wind as { wx: number; wy: number } | undefined;
      const windSpeed = wind ? Math.sqrt(wind.wx * wind.wx + wind.wy * wind.wy).toFixed(1) : null;
      const reason = isDraw
        ? "Same baskets — draw"
        : iWon ? "More baskets" : `${oppName} scored more baskets`;
      return {
        rows: [
          { label: myName,  value: `${myS} / ${myT} throws`,  winner: iWon  && !isDraw },
          { label: oppName, value: `${oppS} / ${oppT} throws`, winner: oppWon && !isDraw },
        ],
        reason,
        answerBlock: windSpeed ? (
          <div className="mt-3 text-sm text-(--muted)">Wind: {windSpeed}</div>
        ) : undefined,
      };
    }

    case "darts": {
      type DartThrow = { score: number; zone: string };
      const totals = stats.totals as Record<string, number> | undefined;
      const throws = stats.throws as Record<string, DartThrow[]> | undefined;
      const myTotal  = totals?.[myIdUsed]  ?? 0;
      const oppTotal = totals?.[oppIdUsed] ?? 0;
      const myThrows  = throws?.[myIdUsed]  ?? [];
      const oppThrows = throws?.[oppIdUsed] ?? [];
      const fmtThrows = (arr: DartThrow[]) => arr.map((t) => `${t.zone}(${t.score})`).join(", ") || "—";
      return {
        rows: [
          { label: myName,  value: `${myTotal} pts`,  winner: iWon  && !isDraw },
          { label: oppName, value: `${oppTotal} pts`, winner: oppWon && !isDraw },
        ],
        reason: isDraw ? "Same score — draw" : iWon ? "Higher score" : `${oppName} scored higher`,
        answerBlock: (
          <div className="mt-3 flex flex-col gap-1 text-xs text-(--muted)">
            <span>{myName}: {fmtThrows(myThrows)}</span>
            <span>{oppName}: {fmtThrows(oppThrows)}</span>
          </div>
        ),
      };
    }

    case "mini_golf": {
      type ShotResult = { distToHole: number; power: number } | null;
      const shots = stats.shots as Record<string, ShotResult> | undefined;
      const courseName = stats.courseName as string | undefined;
      const myShot  = shots?.[myIdUsed]  ?? null;
      const oppShot = shots?.[oppIdUsed] ?? null;
      const fmtDist = (s: ShotResult) =>
        s === null ? "No shot" : s.distToHole === 0 ? "Hole-in-one! ⛳" : `${(s.distToHole * 100).toFixed(0)}cm from hole`;
      const reason = isDraw
        ? "Same distance — draw"
        : iWon ? "Closer to hole" : `${oppName} was closer to hole`;
      return {
        rows: [
          { label: myName,  value: fmtDist(myShot),  winner: iWon  && !isDraw },
          { label: oppName, value: fmtDist(oppShot), winner: oppWon && !isDraw },
        ],
        reason,
        answerBlock: courseName ? (
          <div className="mt-3 text-sm text-(--muted)">Course: {courseName}</div>
        ) : undefined,
      };
    }

    default:
      return null;
  }
}

// ── One-line summary for other matches ────────────────────────────────────────

function MatchOneLine({ match }: { match: MatchResultEntry }) {
  const outcomeLabel = match.isDraw ? "🤝 Draw" : match.winnerName ? `🏆 ${match.winnerName}` : "—";

  let scoreStr = "";
  if (match.scoreSummary) {
    const { aValue, bValue } = match.scoreSummary;
    if (aValue != null && bValue != null) scoreStr = ` (${aValue}–${bValue})`;
  }

  return (
    <div className="flex items-center justify-between py-2 gap-2 flex-wrap">
      <span className="text-base font-medium">
        {match.aName}
        <span className="text-(--muted) mx-1 font-normal">vs</span>
        {match.bName}
      </span>
      <span className="text-(--muted) shrink-0 text-base tabular-nums">
        {outcomeLabel}{scoreStr}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DuelResult({ t, playerId, benchedId, result, onLeave: _onLeave }: Props) {
  const { deltaScores, leaderboard, matches } = result;
  const isBenched = benchedId === playerId;

  const myMatch    = matches.find((m) => m.aId === playerId || m.bId === playerId) ?? null;
  const otherMatches = matches.filter((m) => m !== myMatch);

  let headline: string;
  let headlineEmoji: string;
  if (isBenched) {
    headline = "You were benched this round";
    headlineEmoji = "🪑";
  } else if (!myMatch) {
    headline = "Round complete";
    headlineEmoji = "✅";
  } else {
    const iWon = myMatch.winnerId === playerId;
    const draw = myMatch.isDraw;
    headline = draw ? t.itsDraw : iWon ? t.youWon : t.youLost;
    headlineEmoji = draw ? "🤝" : iWon ? "🏆" : "😢";
  }

  const myDelta = isBenched ? 0 : (deltaScores[playerId] ?? 0);
  const deltaLabel = myDelta > 0 ? t.pointsEarned.replace("{n}", String(myDelta)) : "";

  const breakdown = (!isBenched && myMatch) ? buildBreakdown(myMatch, playerId) : null;

  const otherToShow = isBenched ? matches : otherMatches;

  return (
    <main className="flex flex-col items-center px-4 py-8 gap-4 max-w-sm mx-auto">
      {/* Headline */}
      <div className="flex flex-col items-center gap-3 py-2 w-full text-center">
        <p className="text-5xl">{headlineEmoji}</p>
        <p className="text-3xl font-bold">{headline}</p>
        {deltaLabel && <Chip size="lg" color="success" variant="soft" className="text-base px-4">{deltaLabel}</Chip>}
      </div>

      {/* Your match breakdown (active duelists only) */}
      {!isBenched && myMatch && breakdown && (
        <Card className="w-full">
          <Card.Content className="flex flex-col gap-3 p-4">
            <p className="text-sm font-semibold text-(--muted) uppercase tracking-widest">Your match</p>
            <p className="text-lg font-semibold text-center">
              {myMatch.aName}
              <span className="text-(--muted) font-normal mx-2">vs</span>
              {myMatch.bName}
            </p>
            <div className="flex flex-col gap-2">
              {breakdown.rows.map((row) => (
                <div
                  key={row.label}
                  className={[
                    "flex items-center justify-between rounded-xl px-4 py-3",
                    row.winner ? "bg-(--success)/15 border border-(--success)/30" : "bg-(--surface-secondary)",
                  ].join(" ")}
                >
                  <span className={`font-semibold text-base truncate mr-2 ${row.winner ? "text-(--success)" : ""}`}>
                    {row.label}{row.winner && " 🏆"}
                  </span>
                  <span className={`text-base tabular-nums shrink-0 ${row.winner ? "font-bold text-(--success)" : "text-(--muted)"}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            {breakdown.answerBlock}
            <p className="text-base text-(--muted) text-center">{breakdown.reason}</p>
          </Card.Content>
        </Card>
      )}

      {/* Benched message */}
      {isBenched && (
        <Card className="w-full">
          <Card.Content className="flex flex-col items-center gap-3 py-6 px-4 text-center">
            <span className="text-4xl">🪑</span>
            <p className="text-base font-semibold">{t.benchedThisDuel}</p>
          </Card.Content>
        </Card>
      )}

      {/* Other matches (or all matches if benched) */}
      {otherToShow.length > 0 && (
        <Card className="w-full">
          <Card.Content className="flex flex-col gap-2 p-4">
            <p className="text-sm font-semibold text-(--muted) uppercase tracking-widest">
              {isBenched ? "All matches" : "Other matches"}
            </p>
            <div className="flex flex-col divide-y divide-(--border)">
              {otherToShow.map((m) => (
                <MatchOneLine key={`${m.aId}-${m.bId}`} match={m} />
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Leaderboard */}
      <Card className="w-full">
        <Card.Content className="flex flex-col gap-3 p-4">
          <p className="text-sm font-semibold text-(--muted) uppercase tracking-widest">{t.players}</p>
          <ul className="flex flex-col gap-2">
            {leaderboard.map((entry, i) => (
              <li key={entry.id} className="flex justify-between items-center text-base">
                <span className="flex items-center gap-2">
                  <span className="text-(--muted) w-5">{i + 1}.</span>
                  <span className={entry.id === playerId ? "font-bold" : ""}>{entry.name}</span>
                  {(deltaScores[entry.id] ?? 0) > 0 && (
                    <span className="text-(--success) text-sm font-semibold">+{deltaScores[entry.id]}</span>
                  )}
                </span>
                <span className="tabular-nums font-semibold">{entry.score} {t.pts}</span>
              </li>
            ))}
          </ul>
        </Card.Content>
      </Card>

      <p className="text-base text-(--muted)">{t.nextDuelIn}</p>
    </main>
  );
}
