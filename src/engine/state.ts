import { BALANCE } from "../config/balance";
import { OBJECTIVES } from "../config/objectives";
import { PATHS } from "../config/paths";
import type { Avatar, DayLedger, GameState, MarketingPlan, PathId, Totals } from "./types";

export const SCHEMA_VERSION = 1;

export function emptyTotals(): Totals {
  return {
    grossRevenue: 0,
    refunds: 0,
    paymentFees: 0,
    affiliateCommissions: 0,
    directCosts: 0,
    operatingCosts: 0,
    adSpend: 0,
    otherIncome: 0,
    investments: 0,
    sales: 0,
    customers: 0,
  };
}

export function emptyLedger(cashStart = 0): DayLedger {
  return { cashStart, operating: 0, investments: 0, refunds: 0, otherIncome: 0, notes: [] };
}

export function defaultPlan(): MarketingPlan {
  return {
    posts: 1,
    adBudget: 0,
    email: false,
    affiliateOn: false,
    affiliateCommission: 0.3,
    featuredProductId: null,
    coachingSlots: 0,
    hustle: false,
    rest: false,
    sideGig: false,
  };
}

export interface NewGameOptions {
  seed: number;
  path: PathId;
  niche?: string;
  creatorName?: string;
  avatar?: Avatar;
}

export function createNewGame(opts: NewGameOptions): GameState {
  const p = PATHS[opts.path];
  const niche = opts.niche && p.topics.includes(opts.niche) ? opts.niche : p.topics[0]!;
  return {
    schemaVersion: SCHEMA_VERSION,
    seed: opts.seed >>> 0,
    creatorName: (opts.creatorName ?? "").trim().slice(0, 24) || "You",
    avatar: opts.avatar ?? { skin: 2, outfit: 0, hair: 0 },
    path: opts.path,
    niche,
    day: 1,
    campaignDays: BALANCE.campaignDays,
    phase: "planning",
    cash: BALANCE.startingCash,
    audience: p.startAudience,
    audienceFit: p.startFit,
    emailList: p.startEmail,
    emailFreshness: 1,
    affiliates: 0,
    reputation: p.startReputation,
    satisfaction: BALANCE.startingSatisfaction,
    wellbeing: 85,
    products: [],
    nextProductNumber: 1,
    plan: defaultPlan(),
    upgrades: [],
    modifiers: [],
    pendingPayouts: [],
    scheduledRefunds: [],
    pendingEvent: null,
    eventHistory: [],
    lastEventDay: 0,
    history: [],
    totals: emptyTotals(),
    rank: 0,
    milestones: [],
    objectives: OBJECTIVES.map((o) => ({ id: o.id, done: false, doneDay: null })),
    storiesUnlocked: [],
    postsMade: 0,
    emailsSent: 0,
    adDays: 0,
    sideGigs: 0,
    negativeCashDays: 0,
    outcome: null,
    tutorialDone: false,
    inbox: [],
    hoursCommitted: 0,
    dayFlags: [],
    dayLedger: emptyLedger(BALANCE.startingCash),
  };
}

/** Deep clone via structured JSON (state is plain data). */
export function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}
