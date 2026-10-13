import { BALANCE } from "../config/balance";
import { ACTIVE_OBJECTIVES, OBJECTIVE_BY_ID, OBJECTIVES } from "../config/objectives";
import { FIRST_SALE_MILESTONE, RANKS } from "../config/ranks";
import { STORY_BY_ID } from "../config/stories";
import { clamp, netProfit, netRevenue } from "./economy";
import type { GameState, Outcome } from "./types";

export function rankForRevenue(revenue: number): number {
  let r = 0;
  RANKS.forEach((rank, i) => {
    if (revenue >= rank.threshold) r = i;
  });
  return r;
}

export function unlockStory(s: GameState, storyId: string): void {
  if (s.storiesUnlocked.includes(storyId) || !STORY_BY_ID[storyId]) return;
  s.storiesUnlocked.push(storyId);
  const story = STORY_BY_ID[storyId]!;
  s.inbox.push({ kind: "story", id: storyId, title: `Creator Story: ${story.title}`, body: story.lesson });
}

export function checkProgression(s: GameState): void {
  // First sale milestone
  if (s.totals.sales > 0 && !s.milestones.includes(FIRST_SALE_MILESTONE)) {
    s.milestones.push(FIRST_SALE_MILESTONE);
    s.inbox.push({ kind: "milestone", id: FIRST_SALE_MILESTONE, title: "First sale!", body: "Someone paid for something you made." });
  }
  // Ranks
  const newRank = rankForRevenue(netRevenue(s));
  while (s.rank < newRank) {
    s.rank++;
    const r = RANKS[s.rank]!;
    s.milestones.push(`rank-${r.id}`);
    s.reputation = clamp(s.reputation + 3, 0, 100);
    s.inbox.push({ kind: "rank", id: r.id, title: `Rank up: ${r.name}`, body: r.perk });
    if (r.id === "entrepreneur") unlockStory(s, "getting-paid");
  }
  // Situational Creator Stories
  if (s.products.some((p) => p.status === "live" && p.price > 0 && p.launchedDay !== null && s.day - p.launchedDay >= 3 && p.sales <= 2))
    unlockStory(s, "weak-launch");
  if (s.rank >= 1) unlockStory(s, "dont-underprice");
  if (s.wellbeing < 45) unlockStory(s, "rest");
  if (s.eventHistory.some((e) => e.eventId === "piracy")) unlockStory(s, "piracy");
  // Objectives: only active (first N incomplete) objectives can complete, in order.
  let guard = 0;
  let changed = true;
  while (changed && guard++ < 20) {
    changed = false;
    for (const prog of activeObjectives(s)) {
      const def = OBJECTIVE_BY_ID[prog.id];
      if (!def || prog.done) continue;
      if (def.check(s)) {
        prog.done = true;
        prog.doneDay = s.day;
        if (def.reward.cash) {
          s.cash += def.reward.cash;
          s.totals.otherIncome += def.reward.cash;
        }
        if (def.reward.reputation) s.reputation = clamp(s.reputation + def.reward.reputation, 0, 100);
        s.inbox.push({ kind: "objective", id: def.id, title: `Objective complete: ${def.title}`, body: def.rewardText });
        if (def.reward.story) unlockStory(s, def.reward.story);
        changed = true;
      }
    }
  }
}

export function activeObjectives(s: GameState) {
  return s.objectives.filter((o) => !o.done).slice(0, ACTIVE_OBJECTIVES);
}

export function objectiveCount(s: GameState): number {
  return s.objectives.filter((o) => o.done).length;
}

export const TOTAL_OBJECTIVES = OBJECTIVES.length;

export interface WinCheck {
  rankOk: boolean;
  profitOk: boolean;
  satisfactionOk: boolean;
  won: boolean;
}

export function winCheck(s: GameState): WinCheck {
  const rankOk = s.rank >= BALANCE.winMinRank;
  const profitOk = !BALANCE.winRequiresProfit || netProfit(s) > 0;
  const satisfactionOk = s.satisfaction >= BALANCE.winMinSatisfaction;
  return { rankOk, profitOk, satisfactionOk, won: rankOk && profitOk && satisfactionOk };
}

export function finalOutcome(s: GameState): Outcome {
  if (s.negativeCashDays >= BALANCE.insolvencyDays) return "insolvent";
  return winCheck(s).won ? "win" : "survived";
}
