import { GameDefinition } from "@arena/shared";

const DRAW_THRESHOLD_MS = 10;

interface State {
  playerIds: string[];
  triggerAt: number;    // absolute epoch ms when green begins
  reactions: Record<string, number>; // playerId -> epoch ms of tap
  earlyTap: Record<string, boolean>; // playerId -> tapped before green
}

interface Public {
  // Client derives "triggered" from comparing Date.now() with triggerAt
  // Sending the absolute triggerAt lets the client show the exact moment
  triggerAt: number;
  reacted: Record<string, boolean>;  // who has tapped (regardless of early/late)
  earlyTap: Record<string, boolean>; // who tapped early (instant loss)
}

const reactionGreen: GameDefinition<State, Public> = {
  id: "reaction_green",
  displayName: { en: "Reaction Green", ar: "ردة الفعل الخضراء" },
  durationMs: 8000,
  instructions: {
    en: "Tap when it turns GREEN. Tapping too early = instant loss!",
    ar: "انقر عندما يتحول للأخضر. النقر المبكر = خسارة فورية!",
  },
  init(playerIds) {
    // Random delay between 1500ms and 8000ms (within the 8s window)
    const delayMs = 1500 + Math.floor(Math.random() * 5000);
    return {
      playerIds,
      triggerAt: Date.now() + delayMs,
      reactions: {},
      earlyTap: {},
    };
  },
  publicState(s) {
    return {
      triggerAt: s.triggerAt,
      reacted: Object.fromEntries(s.playerIds.map((id) => [id, id in s.reactions || id in s.earlyTap])),
      earlyTap: s.earlyTap,
    };
  },
  input(s, playerId, payload) {
    // Already tapped
    if (playerId in s.reactions || playerId in s.earlyTap) return s;

    // Use client-reported tap time if provided and within ±500ms of server time (sanity-check)
    const clientTapAt = (payload as { clientTapAt?: number })?.clientTapAt;
    const serverNow = Date.now();
    const tapAt = (typeof clientTapAt === "number" && Math.abs(clientTapAt - serverNow) < 500)
      ? clientTapAt
      : serverNow;

    if (tapAt < s.triggerAt) {
      // Early tap — instant loss marker
      return { ...s, earlyTap: { ...s.earlyTap, [playerId]: true } };
    }
    return { ...s, reactions: { ...s.reactions, [playerId]: tapAt } };
  },
  isResolved(s) {
    // Any early tap is immediately final
    if (Object.keys(s.earlyTap).length > 0) return true;
    // Both reacted after green → done
    return s.playerIds.every((id) => id in s.reactions);
  },
  resolve(s) {
    const [a, b] = s.playerIds;
    const outcomeByPlayerId: Record<string, number> = {};

    const aEarly = s.earlyTap[a] ?? false;
    const bEarly = s.earlyTap[b] ?? false;
    const aTime  = s.reactions[a] ?? null;
    const bTime  = s.reactions[b] ?? null;

    // Both tapped early → draw
    if (aEarly && bEarly) {
      outcomeByPlayerId[a] = 0.5;
      outcomeByPlayerId[b] = 0.5;
    // Only one tapped early → other wins
    } else if (aEarly) {
      outcomeByPlayerId[a] = 0;
      outcomeByPlayerId[b] = 1;
    } else if (bEarly) {
      outcomeByPlayerId[a] = 1;
      outcomeByPlayerId[b] = 0;
    // Neither tapped (time expired) → draw
    } else if (!aTime && !bTime) {
      outcomeByPlayerId[a] = 0.5;
      outcomeByPlayerId[b] = 0.5;
    // Only one reacted
    } else if (!aTime) {
      outcomeByPlayerId[a] = 0;
      outcomeByPlayerId[b] = 1;
    } else if (!bTime) {
      outcomeByPlayerId[a] = 1;
      outcomeByPlayerId[b] = 0;
    // Both reacted — compare times with threshold
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
    return { outcomeByPlayerId, stats: { results } };
  },
};

export default reactionGreen;
