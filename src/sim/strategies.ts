// Scripted player strategies used by the balance script and the test suite.
// Each strategy makes the same kinds of decisions a human would through the UI
// (all via applyAction), so they exercise the real rules.

import { BALANCE } from "../config/balance";
import { UPGRADES } from "../config/upgrades";
import { applyAction } from "../engine/actions";
import {
  activeProductCount,
  emailSendCost,
  hoursBreakdown,
  isProductTypeUnlocked,
  MAX_ACTIVE_PRODUCTS,
  refPrice,
  setupCostFor,
} from "../engine/economy";
import { createNewGame } from "../engine/state";
import type { Action, Effort, GameState, PathId, ProductType } from "../engine/types";

export interface StrategySpec {
  id: string;
  label: string;
  /** Product launch order: [type, price multiplier of reference price]. */
  products: [ProductType, number, Effort?][];
  posts: number;
  adShare: number; // share of cash spent on ads per day
  adMin?: number;
  email: "never" | "fresh" | "always";
  affiliate: number; // 0 = off, else commission
  coachingSlots: number;
  hustle: boolean;
  upgrades: string[]; // purchase priority
  upgradeReserve: number; // keep this much cash after buying upgrades
  sideGigWhenBroke: boolean;
  restBelow: number;
  improve: boolean;
}

export const STRATEGIES: StrategySpec[] = [
  {
    id: "organic",
    label: "Organic-first growth",
    products: [["ebook", 1], ["template", 1], ["course", 1.0], ["membership", 1]],
    posts: 3,
    adShare: 0,
    email: "fresh",
    affiliate: 0,
    coachingSlots: 0,
    hustle: false,
    upgrades: ["ringlight", "planner", "design", "chair", "mic", "emailsuite", "helpdesk", "camera", "makeover"],
    upgradeReserve: 3_000,
    sideGigWhenBroke: true,
    restBelow: 35,
    improve: true,
  },
  {
    id: "ads",
    label: "Paid advertising",
    products: [["ebook", 1], ["course", 1.0], ["template", 1]],
    posts: 1,
    adShare: 0.45,
    adMin: 1_000,
    email: "fresh",
    affiliate: 0,
    coachingSlots: 0,
    hustle: false,
    upgrades: ["adskills", "design", "ringlight", "helpdesk", "chair", "mic", "makeover"],
    upgradeReserve: 8_000,
    sideGigWhenBroke: true,
    restBelow: 35,
    improve: true,
  },
  {
    id: "affiliate",
    label: "Affiliate partnerships",
    products: [["ebook", 1], ["course", 1.0], ["template", 1]],
    posts: 2,
    adShare: 0,
    email: "fresh",
    affiliate: 0.4,
    coachingSlots: 0,
    hustle: false,
    upgrades: ["ringlight", "design", "planner", "helpdesk", "chair", "mic", "makeover"],
    upgradeReserve: 3_000,
    sideGigWhenBroke: true,
    restBelow: 35,
    improve: true,
  },
  {
    id: "email",
    label: "Email marketing",
    products: [["ebook", 1], ["template", 0], ["course", 1.0]],
    posts: 2,
    adShare: 0,
    email: "fresh",
    affiliate: 0,
    coachingSlots: 0,
    hustle: false,
    upgrades: ["emailsuite", "ringlight", "design", "planner", "helpdesk", "chair", "makeover"],
    upgradeReserve: 3_000,
    sideGigWhenBroke: true,
    restBelow: 35,
    improve: true,
  },
  {
    id: "volume",
    label: "High-volume, low price",
    products: [["ebook", 0.4], ["template", 0.35], ["ebook", 0.5]],
    posts: 3,
    adShare: 0.2,
    email: "fresh",
    affiliate: 0.3,
    coachingSlots: 0,
    hustle: false,
    upgrades: ["ringlight", "design", "planner", "helpdesk", "chair"],
    upgradeReserve: 3_000,
    sideGigWhenBroke: true,
    restBelow: 35,
    improve: false,
  },
  {
    id: "premium",
    label: "Higher-priced products",
    products: [["coaching", 1.5], ["course", 2.0], ["ebook", 2]],
    posts: 2,
    adShare: 0.1,
    email: "fresh",
    affiliate: 0,
    coachingSlots: 2,
    hustle: false,
    upgrades: ["ringlight", "mic", "helpdesk", "chair", "camera", "makeover"],
    upgradeReserve: 5_000,
    sideGigWhenBroke: true,
    restBelow: 35,
    improve: true,
  },
  {
    id: "diversify",
    label: "Product diversification",
    products: [["ebook", 1], ["template", 1], ["coaching", 1], ["course", 1], ["membership", 1], ["event", 1]],
    posts: 2,
    adShare: 0.15,
    email: "fresh",
    affiliate: 0.3,
    coachingSlots: 1,
    hustle: false,
    upgrades: ["ringlight", "design", "planner", "chair", "helpdesk", "emailsuite", "mic", "venue", "makeover"],
    upgradeReserve: 4_000,
    sideGigWhenBroke: true,
    restBelow: 35,
    improve: true,
  },
  {
    id: "conservative",
    label: "Conservative growth",
    products: [["ebook", 1], ["template", 1], ["course", 1]],
    posts: 2,
    adShare: 0,
    email: "fresh",
    affiliate: 0,
    coachingSlots: 0,
    hustle: false,
    upgrades: ["ringlight", "planner"],
    upgradeReserve: 20_000,
    sideGigWhenBroke: true,
    restBelow: 50,
    improve: false,
  },
  {
    id: "aggressive",
    label: "Aggressive growth",
    products: [["ebook", 1], ["coaching", 1], ["course", 1], ["template", 1], ["membership", 1], ["event", 1]],
    posts: 3,
    adShare: 0.8,
    adMin: 500,
    email: "always",
    affiliate: 0.5,
    coachingSlots: 4,
    hustle: true,
    upgrades: ["camera", "chair", "assistant", "inverter", "adskills", "makeover"],
    upgradeReserve: 0,
    sideGigWhenBroke: false,
    restBelow: 0,
    improve: false,
  },
  {
    id: "idle",
    label: "Do almost nothing",
    products: [],
    posts: 0,
    adShare: 0,
    email: "never",
    affiliate: 0,
    coachingSlots: 0,
    hustle: false,
    upgrades: [],
    upgradeReserve: 0,
    sideGigWhenBroke: false,
    restBelow: 0,
    improve: false,
  },
];

function tryAct(s: GameState, a: Action): GameState {
  const r = applyAction(s, a);
  return r.ok ? r.state : s;
}

function roundPrice(v: number): number {
  if (v === 0) return 0;
  return Math.max(100, Math.round(v / 100) * 100);
}

/** Decide and apply one day's worth of actions, then end the day. */
export function playDay(s: GameState, spec: StrategySpec): GameState {
  // 1. Resolve any event: pick the first zero-cost option, or a cheap fix if well funded.
  if (s.pendingEvent) {
    const ev = s.pendingEvent;
    const free = hoursBreakdown(s).free;
    const feasible = ev.choices.filter((c) => (c.cost === 0 || c.cost <= s.cash * 0.25) && (c.hoursCost ?? 0) <= free);
    for (const c of feasible) {
      s = tryAct(s, { type: "resolveEvent", choiceId: c.id });
      if (!s.pendingEvent) break;
    }
  }

  // 2. Launch next product in the plan when nothing is in development.
  const developing = s.products.some((p) => p.status === "developing");
  const launched = s.products.length;
  if (!developing && launched < spec.products.length && activeProductCount(s) < MAX_ACTIVE_PRODUCTS) {
    const [type, mult, effort] = spec.products[launched]!;
    if (isProductTypeUnlocked(s, type)) {
      const price = roundPrice(refPrice(s, type, s.niche) * mult);
      const cost = setupCostFor(s, type, s.niche);
      if (s.cash >= cost + 300)
        s = tryAct(s, { type: "createProduct", productType: type, topic: s.niche, price, effort: effort ?? "standard" });
    }
  }

  // 3. Upgrades in priority order.
  for (const id of spec.upgrades) {
    if (s.upgrades.includes(id)) continue;
    const u = UPGRADES.find((x) => x.id === id)!;
    if (s.rank >= u.minRank && s.cash - u.cost >= spec.upgradeReserve) s = tryAct(s, { type: "buyUpgrade", upgradeId: id });
    break;
  }

  // 4. Improve weak products.
  if (spec.improve) {
    const weak = s.products.find((p) => p.status === "live" && p.quality < 0.85 && p.improvements < 2 && p.sales >= 3);
    if (weak && s.cash > 5_000) s = tryAct(s, { type: "improveProduct", productId: weak.id });
  }

  // 5. Daily plan.
  const live = s.products.filter((p) => p.status === "live");
  const paidLive = live.filter((p) => p.price > 0);
  const best = [...paidLive].sort((a, b) => b.revenue - a.revenue)[0];
  const featured = best ?? live[0];
  const rest = s.wellbeing < spec.restBelow && !s.products.some((p) => p.type === "event" && p.status === "live" && p.eventDay === s.day);
  if (rest) {
    s = tryAct(s, { type: "setPlan", plan: { rest: true } });
  } else {
    const hasCoaching = live.some((p) => p.type === "coaching");
    const broke = spec.sideGigWhenBroke && s.cash < 1_500;
    const wantEmail =
      spec.email === "always" ? s.emailList > 0 : spec.email === "fresh" ? s.emailFreshness > 0.75 && s.emailList > 30 && paidLive.length > 0 : false;
    const fixed = BALANCE.dailyDataCost + 1_500;
    const adBudget =
      spec.adShare > 0 && paidLive.length > 0 && s.cash > (spec.adMin ?? 2_000)
        ? Math.floor((Math.max(0, s.cash - fixed) * spec.adShare) / 500) * 500
        : 0;
    let plan = {
      rest: false,
      hustle: spec.hustle && s.wellbeing > 25,
      posts: spec.posts,
      email: wantEmail && s.cash > emailSendCost(s) + 500,
      adBudget,
      affiliateOn: spec.affiliate > 0,
      affiliateCommission: spec.affiliate || 0.3,
      featuredProductId: featured?.id ?? null,
      coachingSlots: hasCoaching ? spec.coachingSlots : 0,
      sideGig: broke,
    };
    // Shrink the plan until it's valid.
    for (let i = 0; i < 12; i++) {
      const r = applyAction(s, { type: "setPlan", plan });
      if (r.ok) {
        s = r.state;
        break;
      }
      if (plan.sideGig && i > 4) plan = { ...plan, sideGig: false };
      else if (plan.coachingSlots > 0) plan = { ...plan, coachingSlots: plan.coachingSlots - 1 };
      else if (plan.posts > 0) plan = { ...plan, posts: plan.posts - 1 };
      else if (plan.adBudget > 0) plan = { ...plan, adBudget: Math.floor(plan.adBudget / 2 / 100) * 100 };
      else if (plan.email) plan = { ...plan, email: false };
      else plan = { ...plan, sideGig: false, hustle: false };
    }
  }

  const r = applyAction(s, { type: "endDay", expectedDay: s.day });
  if (!r.ok) throw new Error(`endDay failed on day ${s.day}: ${r.error} ${JSON.stringify(s.pendingEvent)} cash=${s.cash} ${JSON.stringify(hoursBreakdown(s))}`);
  return r.state;
}

export function playCampaign(seed: number, pathId: PathId, spec: StrategySpec, niche?: string): GameState {
  let s = createNewGame({ seed, path: pathId, niche });
  let guard = 0;
  while (s.phase !== "ended" && guard++ < 40) s = playDay(s, spec);
  return s;
}
