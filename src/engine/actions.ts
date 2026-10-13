// The action reducer: every player decision goes through applyAction().
// Each action is validated against the current state so impossible actions,
// duplicate purchases, double day resolution and invalid spending are rejected.

import { BALANCE } from "../config/balance";
import { EVENT_BY_ID } from "../config/events";
import { TOPICS } from "../config/paths";
import { PRODUCT_NAME_IDEAS, PRODUCT_TYPES } from "../config/products";
import { UPGRADE_BY_ID } from "../config/upgrades";
import {
  MAX_ACTIVE_PRODUCTS,
  activeProductCount,
  clamp,
  devHoursFor,
  emailSendCost,
  expectedQuality,
  hoursBreakdown,
  isProductTypeUnlocked,
  isProvenTopic,
  setupCostFor,
  upgradeSum,
} from "./economy";
import { checkProgression } from "./progression";
import { dayRng, normal } from "./rng";
import { resolveDay } from "./simulate";
import { cloneState } from "./state";
import type { Action, ActionResult, GameState, MarketingPlan, Product } from "./types";

const fail = (state: GameState, error: string): ActionResult => ({ state, ok: false, error });
const done = (state: GameState): ActionResult => ({ state, ok: true });

export function applyAction(input: GameState, action: Action): ActionResult {
  if (input.phase === "ended" && action.type !== "clearInbox") return fail(input, "The campaign is over.");
  switch (action.type) {
    case "createProduct":
      return createProduct(input, action);
    case "setPrice":
      return setPrice(input, action.productId, action.price);
    case "retireProduct":
      return retireProduct(input, action.productId);
    case "improveProduct":
      return improveProduct(input, action.productId);
    case "setPlan":
      return setPlan(input, action.plan);
    case "buyUpgrade":
      return buyUpgrade(input, action.upgradeId);
    case "resolveEvent":
      return resolveEvent(input, action.choiceId);
    case "endDay":
      return endDay(input, action.expectedDay);
    case "completeTutorial": {
      const s = cloneState(input);
      s.tutorialDone = true;
      return done(s);
    }
    case "clearInbox": {
      const s = cloneState(input);
      s.inbox = [];
      return done(s);
    }
    default:
      return fail(input, "Unknown action.");
  }
}

export function validPrice(type: Product["type"], price: number): boolean {
  const cfg = PRODUCT_TYPES[type];
  if (!Number.isFinite(price)) return false;
  if (price === 0) return cfg.allowFree;
  return price >= cfg.minPrice && price <= cfg.maxPrice && Number.isInteger(price);
}

function createProduct(input: GameState, a: Extract<Action, { type: "createProduct" }>): ActionResult {
  const cfg = PRODUCT_TYPES[a.productType];
  if (!cfg) return fail(input, "Unknown product type.");
  if (!isProductTypeUnlocked(input, a.productType)) return fail(input, `${cfg.label} unlocks at a higher rank.`);
  if (!TOPICS[a.topic]) return fail(input, "Unknown topic.");
  if (!validPrice(a.productType, a.price)) return fail(input, "Price is outside the allowed range.");
  if (activeProductCount(input) >= MAX_ACTIVE_PRODUCTS)
    return fail(input, `You can run at most ${MAX_ACTIVE_PRODUCTS} products. Retire one first.`);
  if (a.productType === "event" && input.products.some((p) => p.type === "event" && (p.status === "live" || p.status === "developing")))
    return fail(input, "Finish your current event before planning another.");
  const cost = setupCostFor(input, a.productType, a.topic);
  if (input.cash < cost) return fail(input, "Not enough cash for the setup cost.");

  const s = cloneState(input);
  const rng = dayRng(s.seed, s.day, `product-${s.nextProductNumber}`);
  const quality = clamp(expectedQuality(s, a.productType, a.effort) + normal(rng) * BALANCE.qualityNoise, 0.2, 1.3);
  const ideas = PRODUCT_NAME_IDEAS[a.productType];
  const topicLabel = TOPICS[a.topic]!.label.split(" & ")[0]!;
  const name = (a.name ?? "").trim().slice(0, 40) || `${topicLabel} ${ideas[(s.nextProductNumber - 1) % ideas.length]}`;
  const product: Product = {
    id: `p${s.nextProductNumber}`,
    type: a.productType,
    name,
    topic: a.topic,
    price: a.price,
    quality: Math.round(quality * 100) / 100,
    status: "developing",
    devHoursTotal: devHoursFor(s, a.productType, a.effort, a.topic),
    devHoursDone: 0,
    createdDay: s.day,
    launchedDay: null,
    sales: 0,
    revenue: 0,
    refunds: 0,
    refundedAmount: 0,
    adFatigue: 0,
    members: [],
    capacity: 0,
    ticketsSold: 0,
    eventDay: null,
    improvements: 0,
    provenTopic: isProvenTopic(s, a.topic),
  };
  s.nextProductNumber++;
  s.products.push(product);
  s.cash -= cost;
  s.dayLedger.operating += cost;
  checkProgression(s);
  return done(s);
}

function setPrice(input: GameState, productId: string, price: number): ActionResult {
  const p = input.products.find((x) => x.id === productId);
  if (!p) return fail(input, "Product not found.");
  if (p.status === "retired" || p.status === "completed") return fail(input, "This product is no longer on sale.");
  if (!validPrice(p.type, price)) return fail(input, "Price is outside the allowed range.");
  if (p.type === "event" && p.ticketsSold > 0) return fail(input, "Tickets have been sold; the price is locked.");
  const s = cloneState(input);
  s.products.find((x) => x.id === productId)!.price = price;
  return done(s);
}

function retireProduct(input: GameState, productId: string): ActionResult {
  const p = input.products.find((x) => x.id === productId);
  if (!p) return fail(input, "Product not found.");
  if (p.status === "retired" || p.status === "completed") return fail(input, "Already off sale.");
  if (p.type === "event" && p.ticketsSold > 0) return fail(input, "People have bought tickets. You must host this event.");
  const s = cloneState(input);
  const prod = s.products.find((x) => x.id === productId)!;
  prod.status = "retired";
  prod.members = [];
  if (s.plan.featuredProductId === productId) s.plan.featuredProductId = null;
  if (prod.type === "coaching" && !s.products.some((x) => x.type === "coaching" && x.status === "live")) s.plan.coachingSlots = 0;
  return done(s);
}

function improveProduct(input: GameState, productId: string): ActionResult {
  const p = input.products.find((x) => x.id === productId);
  if (!p) return fail(input, "Product not found.");
  if (p.status !== "live") return fail(input, "Only live products can be improved.");
  if (p.improvements >= BALANCE.maxImprovements) return fail(input, "This product can't be improved further.");
  if (input.dayFlags.includes(`improve-${productId}`)) return fail(input, "Already improved today.");
  if (input.cash < BALANCE.improveCost) return fail(input, "Not enough cash.");
  if (input.plan.rest) return fail(input, "You're resting today.");
  if (hoursBreakdown(input).free < BALANCE.improveHours) return fail(input, "Not enough free hours today.");
  const s = cloneState(input);
  const prod = s.products.find((x) => x.id === productId)!;
  prod.quality = Math.round(clamp(prod.quality + BALANCE.improveQuality, 0.2, 1.3) * 100) / 100;
  prod.improvements++;
  prod.adFatigue = 0;
  s.cash -= BALANCE.improveCost;
  s.dayLedger.operating += BALANCE.improveCost;
  s.hoursCommitted += BALANCE.improveHours;
  s.dayFlags.push(`improve-${productId}`);
  return done(s);
}

function setPlan(input: GameState, patch: Partial<MarketingPlan>): ActionResult {
  const s = cloneState(input);
  const plan: MarketingPlan = { ...s.plan, ...patch };
  plan.posts = clamp(Math.round(plan.posts), 0, 3);
  plan.adBudget = Math.max(0, Math.round(plan.adBudget / 100) * 100);
  plan.affiliateCommission = clamp(Math.round(plan.affiliateCommission * 100) / 100, 0.1, 0.6);
  plan.coachingSlots = clamp(Math.round(plan.coachingSlots), 0, 5);
  if (plan.email && s.emailList <= 0) plan.email = false;
  if (plan.coachingSlots > 0 && !s.products.some((p) => p.type === "coaching" && p.status === "live"))
    return fail(input, "Launch a coaching product before offering sessions.");
  if (plan.featuredProductId && !s.products.some((p) => p.id === plan.featuredProductId && p.status === "live"))
    plan.featuredProductId = null;
  if (plan.rest) {
    if (s.products.some((p) => p.type === "event" && p.status === "live" && p.eventDay === s.day))
      return fail(input, "You're hosting an event today. You can't take the day off.");
    if (s.hoursCommitted > 0) return fail(input, "You've already committed hours today.");
    plan.posts = 0;
    plan.email = false;
    plan.coachingSlots = 0;
    plan.sideGig = false;
    plan.hustle = false;
  }
  s.plan = plan;

  // Hours check (upkeep is mandatory; only optional work must fit).
  const hb = hoursBreakdown(s);
  const optional = hb.content + hb.email + hb.coaching + hb.sideGig;
  const room = Math.max(0, hb.available - hb.upkeep - hb.committed);
  if (optional > room + 1e-9) return fail(input, "Not enough hours today for that plan.");

  // Spending check: unavoidable costs are reserved first.
  const fixed = BALANCE.dailyDataCost + upgradeSum(s, "dailyCost");
  const discretionary = plan.adBudget + plan.posts * BALANCE.postDataCost + (plan.email ? emailSendCost(s) : 0);
  if (discretionary > 0 && discretionary > Math.max(0, s.cash - fixed)) return fail(input, "Not enough cash for that plan.");
  return done(s);
}

function buyUpgrade(input: GameState, upgradeId: string): ActionResult {
  const u = UPGRADE_BY_ID[upgradeId];
  if (!u) return fail(input, "Unknown upgrade.");
  if (input.upgrades.includes(upgradeId)) return fail(input, "Already owned.");
  if (input.rank < u.minRank) return fail(input, "Reach a higher rank to unlock this upgrade.");
  if (input.cash < u.cost) return fail(input, "Not enough cash.");
  const s = cloneState(input);
  s.upgrades.push(upgradeId);
  s.cash -= u.cost;
  s.dayLedger.investments += u.cost;
  if (u.effects.reputationOnce) s.reputation = clamp(s.reputation + u.effects.reputationOnce, 0, 100);
  return done(s);
}

function resolveEvent(input: GameState, choiceId: string): ActionResult {
  const ev = input.pendingEvent;
  if (!ev) return fail(input, "No event to resolve.");
  const def = EVENT_BY_ID[ev.eventId];
  const choice = ev.choices.find((c) => c.id === choiceId);
  if (!def || !choice) return fail(input, "Invalid choice.");
  if (choice.cost > 0 && choice.cost > input.cash) return fail(input, "Not enough cash for that option.");
  if (choice.hoursCost && hoursBreakdown(input).free < choice.hoursCost) return fail(input, "Not enough free hours for that option.");
  const s = cloneState(input);
  s.cash -= choice.cost;
  if (choice.cost > 0) {
    const cat = choice.costCategory ?? "operating";
    if (cat === "refund") s.dayLedger.refunds += choice.cost;
    else if (cat === "investment") s.dayLedger.investments += choice.cost;
    else s.dayLedger.operating += choice.cost;
  }
  if (choice.hoursCost) s.hoursCommitted += choice.hoursCost;
  const result = def.apply(s, choiceId, ev.params);
  s.dayLedger.notes.push(`${ev.title}: ${result}`);
  s.eventHistory.push({ day: s.day, eventId: ev.eventId, choiceId });
  s.pendingEvent = null;
  // Make sure the plan still fits after the event changed hours or cash.
  const hb = hoursBreakdown(s);
  const room = Math.max(0, hb.available - hb.upkeep - hb.committed);
  while (hb.content + hb.email + hb.coaching + hb.sideGig > room && (s.plan.sideGig || s.plan.posts > 0 || s.plan.coachingSlots > 0 || s.plan.email)) {
    if (s.plan.sideGig) s.plan.sideGig = false;
    else if (s.plan.posts > 0) s.plan.posts--;
    else if (s.plan.coachingSlots > 0) s.plan.coachingSlots--;
    else s.plan.email = false;
    Object.assign(hb, hoursBreakdown(s));
  }
  if (s.plan.adBudget > Math.max(0, s.cash - BALANCE.dailyDataCost)) s.plan.adBudget = Math.max(0, Math.floor((s.cash - BALANCE.dailyDataCost) / 500) * 500);
  return done(s);
}

function endDay(input: GameState, expectedDay: number): ActionResult {
  if (input.phase !== "planning") return fail(input, "The campaign is over.");
  if (expectedDay !== input.day) return fail(input, "This day has already been resolved.");
  if (input.pendingEvent) return fail(input, "Decide how to handle today's event first.");
  return done(resolveDay(input));
}

/** Convenience used by tests and the balance script. */
export function act(s: GameState, action: Action): GameState {
  const r = applyAction(s, action);
  if (!r.ok) throw new Error(`${action.type} failed: ${r.error}`);
  return r.state;
}

