// Final score. Rewards profitability first, then revenue, audience growth,
// reputation, customer satisfaction and objectives. Revenue made at a loss scores
// far less than a smaller profitable business.

import { PATHS } from "../config/paths";
import { netProfit, netRevenue } from "./economy";
import { objectiveCount } from "./progression";
import type { GameState } from "./types";

export interface ScoreBreakdown {
  profit: number;
  revenue: number;
  audience: number;
  reputation: number;
  satisfaction: number;
  objectives: number;
  rank: number;
  outcomeBonus: number;
  total: number;
  grade: "S" | "A" | "B" | "C" | "D";
}

export function computeScore(s: GameState): ScoreBreakdown {
  const np = netProfit(s);
  const rev = netRevenue(s);
  // Profit: 1 point per ₦100 of profit, losses cost double.
  const profit = np >= 0 ? Math.round(np / 100) : Math.round((np / 100) * 2);
  // Revenue: diminishing (square-root) so revenue alone can't dominate.
  const revenue = Math.round(Math.sqrt(Math.max(0, rev)) * 4);
  const startAudience = PATHS[s.path].startAudience;
  const growth = Math.max(0, s.audience - startAudience);
  const audience = Math.round(Math.sqrt(growth) * 15 * (0.5 + s.audienceFit));
  const reputation = Math.round(s.reputation * 20);
  const satisfaction = Math.round(s.satisfaction * 15);
  const objectives = objectiveCount(s) * 250;
  const rank = s.rank * 500;
  const outcomeBonus = s.outcome === "win" ? 2_000 : s.outcome === "insolvent" ? -2_000 : 0;
  const total = Math.max(0, profit + revenue + audience + reputation + satisfaction + objectives + rank + outcomeBonus);
  const grade = total >= 40_000 ? "S" : total >= 18_000 ? "A" : total >= 9_000 ? "B" : total >= 4_500 ? "C" : "D";
  return { profit, revenue, audience, reputation, satisfaction, objectives, rank, outcomeBonus, total, grade };
}
