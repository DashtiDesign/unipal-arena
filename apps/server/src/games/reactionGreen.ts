import { GameDefinition } from "@arena/shared";

const DRAW_THRESHOLD_MS = 10;
const ROUND_DURATION_MS = 15_000;
// Green appears between 1000ms and 5000ms after game start (within first 5s, server-authoritative)
const GREEN_MIN_DELAY_MS = 1000;
const GREEN_MAX_DELAY_MS = 5000;
// Grace window: absorbs clock-sync residual jitter and render-pipeline latency.
// A tap that arrives up to EARLY_TAP_GRACE_MS before triggerAt is treated as valid (not early).
// This does NOT allow true early taps — 16ms ≈ one render frame, within legitimate jitter range.
const EARLY_TAP_GRACE_MS = 16;

interface State {
  playerIds: string[];
  triggerAt: number;    // absolute epoch ms when green begins (server-set, authoritative)
  endsAt: number;       // absolute epoch ms when round ends (for client display)
  reactions: Record<string, number>; // playerId -> epoch ms of tap (server-authoritative)
  earlyTap: Record<string, boolean>; // playerId -> tapped before green
  // Display-only client-measured reaction times (not used for winner logic)
  displayMs: Record<string, number>;
}

interface Public {
  triggerAt: number;
  endsAt: number;
  reacted: Record<string, boolean>;
  earlyTap: Record<string, boolean>;
}

const reactionGreen: GameDefinition<State, Public> = {
  id: "reaction_green",
  displayName: { en: "Reaction Time", ar: "وقت ردّة الفعل" },
  durationMs: ROUND_DURATION_MS,
  instructions: {
    en: "Tap when it turns GREEN. Tapping too early = you lose your chance!",
    ar: "انقر عندما يتحول للأخضر. النقر المبكر = تخسر فرصتك!",
  },
  init(playerIds) {
    const now = Date.now();
    const delayMs = GREEN_MIN_DELAY_MS + Math.floor(Math.random() * (GREEN_MAX_DELAY_MS - GREEN_MIN_DELAY_MS));
    return {
      playerIds,
      triggerAt: now + delayMs,
      endsAt: now + ROUND_DURATION_MS,
      reactions: {},
      earlyTap: {},
      displayMs: {},
    };
  },
  publicState(s) {
    return {
      triggerAt: s.triggerAt,
      endsAt: s.endsAt,
      reacted: Object.fromEntries(s.playerIds.map((id) => [id, id in s.reactions || id in s.earlyTap])),
      earlyTap: s.earlyTap,
    };
  },
  input(s, playerId, payload) {
    if (playerId in s.reactions || playerId in s.earlyTap) return s;

    // Use clock-offset-corrected eventServerTime if provided (injected by GAME_INPUT handler).
    const p = payload as { eventServerTime?: number; displayReactionMs?: number };
    const tapAt = typeof p.eventServerTime === "number" ? p.eventServerTime : Date.now();

    if (process.env.DEBUG_REACTION === "1") {
      const delta = tapAt - s.triggerAt;
      console.log(
        `[reaction_green] playerId=${playerId}` +
        ` tapAt=${tapAt} triggerAt=${s.triggerAt}` +
        ` delta=${delta}ms grace=${EARLY_TAP_GRACE_MS}ms` +
        ` displayMs=${p.displayReactionMs ?? "n/a"}` +
        ` verdict=${delta < -EARLY_TAP_GRACE_MS ? "EARLY" : "OK"}`
      );
    }

    // Allow taps that arrive up to EARLY_TAP_GRACE_MS before triggerAt —
    // this absorbs clock-sync residual jitter and one render-frame of pipeline latency.
    if (tapAt < s.triggerAt - EARLY_TAP_GRACE_MS) {
      if (process.env.DEBUG_REACTION === "1") {
        console.log(`[reaction_green] EARLY TAP playerId=${playerId} early by ${s.triggerAt - tapAt}ms (grace=${EARLY_TAP_GRACE_MS}ms)`);
      }
      return { ...s, earlyTap: { ...s.earlyTap, [playerId]: true } };
    }

    // Capture client-reported display time (display-only, not used for winner)
    const newDisplayMs = typeof p.displayReactionMs === "number" && p.displayReactionMs >= 0
      ? { ...s.displayMs, [playerId]: Math.round(p.displayReactionMs) }
      : s.displayMs;

    return { ...s, reactions: { ...s.reactions, [playerId]: tapAt }, displayMs: newDisplayMs };
  },
  isResolved(s) {
    // A player is "done" if they have tapped early OR have a valid reaction recorded.
    // Only resolve early when ALL players are done — this lets the non-early player
    // continue playing after their opponent false-starts.
    return s.playerIds.every((id) => id in s.earlyTap || id in s.reactions);
  },
  resolve(s) {
    const [a, b] = s.playerIds;
    const outcomeByPlayerId: Record<string, number> = {};

    const aEarly = s.earlyTap[a] ?? false;
    const bEarly = s.earlyTap[b] ?? false;
    const aTime  = s.reactions[a] ?? null;
    const bTime  = s.reactions[b] ?? null;

    if (aEarly && bEarly) {
      outcomeByPlayerId[a] = 0.5;
      outcomeByPlayerId[b] = 0.5;
    } else if (aEarly) {
      outcomeByPlayerId[a] = 0;
      outcomeByPlayerId[b] = 1;
    } else if (bEarly) {
      outcomeByPlayerId[a] = 1;
      outcomeByPlayerId[b] = 0;
    } else if (!aTime && !bTime) {
      outcomeByPlayerId[a] = 0.5;
      outcomeByPlayerId[b] = 0.5;
    } else if (!aTime) {
      outcomeByPlayerId[a] = 0;
      outcomeByPlayerId[b] = 1;
    } else if (!bTime) {
      outcomeByPlayerId[a] = 1;
      outcomeByPlayerId[b] = 0;
    } else {
      const diff = Math.abs(aTime - bTime);
      if (diff <= DRAW_THRESHOLD_MS) {
        outcomeByPlayerId[a] = 0.5;
        outcomeByPlayerId[b] = 0.5;
      } else if (aTime < bTime) {
        outcomeByPlayerId[a] = 1;
        outcomeByPlayerId[b] = 0;
      } else {
        outcomeByPlayerId[a] = 0;
        outcomeByPlayerId[b] = 1;
      }
    }

    const results: Record<string, { early: boolean; elapsedMs: number | null }> = {
      [a]: { early: aEarly, elapsedMs: aTime != null ? aTime - s.triggerAt : null },
      [b]: { early: bEarly, elapsedMs: bTime != null ? bTime - s.triggerAt : null },
    };
    // displayMs is echoed back for results-page display; not used for winner logic
    return { outcomeByPlayerId, stats: { results, displayMs: s.displayMs } };
  },
};

export default reactionGreen;
