// Derived values used by the simulation and by the UI to preview decisions.
// Everything here is a pure function of GameState.

import { BALANCE } from "../config/balance";
import { PATHS, TOPICS } from "../config/paths";
import {
  COACHING_HOURS_PER_SESSION,
  EVENT_BASE_CAPACITY,
  EVENT_HOST_HOURS,
  MEMBERSHIP_MEMBERS_PER_HOUR,
  MEMBERSHIP_UPKEEP_BASE,
  PRODUCT_TYPES,
} from "../config/products";
import { UPGRADE_BY_ID, type UpgradeEffects } from "../config/upgrades";
import type { Effort, GameState, ModifierKind, Product, ProductType } from "./types";

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round = (v: number) => Math.round(v);

/** Sum of a numeric upgrade effect across owned upgrades. */
export function upgradeSum(s: GameState, key: keyof UpgradeEffects): number {
  let total = 0;
  for (const id of s.upgrades) {
    const v = UPGRADE_BY_ID[id]?.effects[key];
    if (typeof v === "number") total += v;
  }
  return total;
}

/** Product of a multiplicative upgrade effect across owned upgrades. */
export function upgradeProduct(s: GameState, key: keyof UpgradeEffects): number {
  let total = 1;
  for (const id of s.upgrades) {
    const v = UPGRADE_BY_ID[id]?.effects[key];
    if (typeof v === "number") total *= v;
  }
  return total;
}

export function hasUpgradeFlag(s: GameState, key: keyof UpgradeEffects): boolean {
  return s.upgrades.some((id) => UPGRADE_BY_ID[id]?.effects[key] === true);
}

/** Multiplicative modifiers active today. */
export function modProduct(s: GameState, kind: ModifierKind, productType?: ProductType): number {
  let v = 1;
  for (const m of s.modifiers) {
    if (m.kind !== kind) continue;
    if (m.productType && productType && m.productType !== productType) continue;
    if (m.productType && !productType) continue;
    v *= m.value;
  }
  return v;
}

/** Additive modifiers active today. */
export function modSum(s: GameState, kind: ModifierKind): number {
  return s.modifiers.filter((m) => m.kind === kind).reduce((a, m) => a + m.value, 0);
}

export function path(s: GameState) {
  return PATHS[s.path];
}

export function wellbeingFactor(s: GameState): number {
  return s.wellbeing < BALANCE.lowWellbeing ? BALANCE.lowWellbeingPenalty : 1;
}

/** Hours available today before any commitments. */
export function hoursAvailable(s: GameState): number {
  if (s.plan.rest) return 0;
  const base = path(s).baseHours + upgradeSum(s, "hours") + (s.plan.hustle ? BALANCE.hustleHours : 0);
  const mods = modSum(s, "hours");
  return Math.max(0, Math.round((base + mods) * wellbeingFactor(s) * 10) / 10);
}

export function postHours(s: GameState): number {
  return Math.max(1, path(s).postHours - upgradeSum(s, "postHoursCut"));
}

export function membersOf(p: Product): number {
  return p.members.reduce((a, m) => a + m.count, 0);
}

export function totalMembers(s: GameState): number {
  return s.products.filter((p) => p.type === "membership" && p.status === "live").reduce((a, p) => a + membersOf(p), 0);
}

/** Hours that are required regardless of the plan: community upkeep, events, support. */
export function upkeepHours(s: GameState): number {
  let h = 0;
  const live = s.products.filter((p) => p.status === "live");
  for (const p of live) {
    if (p.type === "membership") h += MEMBERSHIP_UPKEEP_BASE + membersOf(p) / MEMBERSHIP_MEMBERS_PER_HOUR;
    if (p.type === "event" && p.eventDay === s.day) h += EVENT_HOST_HOURS;
    h += BALANCE.supportHoursPerProduct;
  }
  const lastSales = s.history.length ? s.history[s.history.length - 1]!.salesByProduct : {};
  const recentSales = Object.values(lastSales).reduce((a, b) => a + b, 0);
  h += recentSales * BALANCE.supportHoursPerSale;
  return Math.round(h * 10) / 10;
}

export interface HoursBreakdown {
  available: number;
  upkeep: number;
  content: number;
  email: number;
  coaching: number;
  sideGig: number;
  committed: number;
  planned: number;
  free: number; // remaining for product development
}

export function hoursBreakdown(s: GameState): HoursBreakdown {
  const available = hoursAvailable(s);
  const upkeep = s.plan.rest ? 0 : upkeepHours(s);
  const content = s.plan.posts * postHours(s);
  const email = s.plan.email ? BALANCE.emailHours : 0;
  const coaching = s.plan.coachingSlots * COACHING_HOURS_PER_SESSION;
  const sideGig = s.plan.sideGig ? BALANCE.sideGigHours : 0;
  const committed = s.hoursCommitted;
  const planned = upkeep + content + email + coaching + sideGig + committed;
  return {
    available,
    upkeep,
    content,
    email,
    coaching,
    sideGig,
    committed,
    planned,
    free: Math.max(0, Math.round((available - planned) * 10) / 10),
  };
}

export function isProductTypeUnlocked(s: GameState, t: ProductType): boolean {
  return path(s).earlyProducts.includes(t) || s.rank >= PRODUCT_TYPES[t].unlockRank;
}

export function refPrice(s: GameState, t: ProductType, topic: string): number {
  const cfg = PRODUCT_TYPES[t];
  const tol = (path(s).priceTolerance[t] ?? 1) * (TOPICS[topic]?.priceTolerance ?? 1);
  return cfg.refPrice * tol;
}

/** Topic is "proven" when an existing product on it has enough sales. */
export function isProvenTopic(s: GameState, topic: string): boolean {
  return s.products.some((p) => p.topic === topic && p.sales >= BALANCE.provenTopicSales);
}

export function devHoursFor(s: GameState, t: ProductType, effort: Effort, topic: string): number {
  const base = PRODUCT_TYPES[t].devHours * (path(s).devHoursMult[t] ?? 1) * BALANCE.effortHoursMultiplier[effort];
  const proven = isProvenTopic(s, topic) ? 1 - BALANCE.provenTopicCostCut : 1;
  return Math.max(1, Math.round(base * proven));
}

export function setupCostFor(s: GameState, t: ProductType, topic: string): number {
  const base = PRODUCT_TYPES[t].setupCost * (path(s).setupCostMult[t] ?? 1);
  const proven = isProvenTopic(s, topic) ? 1 - BALANCE.provenTopicCostCut : 1;
  return Math.round((base * proven) / 50) * 50;
}

export function equipmentQuality(s: GameState): number {
  return upgradeSum(s, "equipment") * path(s).equipmentSensitivity;
}

/** Expected product quality before random noise. */
export function expectedQuality(s: GameState, t: ProductType, effort: Effort): number {
  const skill = path(s).skill[t];
  let typeBonus = 0;
  for (const id of s.upgrades) {
    const qb = UPGRADE_BY_ID[id]?.effects.qualityBonus;
    if (qb && qb[t]) typeBonus += qb[t]!;
  }
  const videoTypes: ProductType[] = ["course", "membership"];
  const equip = videoTypes.includes(t) ? equipmentQuality(s) : 0;
  return clamp(skill + typeBonus + equip + BALANCE.effortQualityBonus[effort], 0.2, 1.3) * (s.wellbeing < BALANCE.lowWellbeing ? 0.92 : 1);
}

export function contentQuality(s: GameState): number {
  const base = BALANCE.baseContentQuality + upgradeSum(s, "contentQuality");
  const pathEquip = path(s).equipmentSensitivity > 1 ? equipmentQuality(s) : 0;
  return clamp((base + pathEquip) * wellbeingFactor(s), 0.3, 1.4);
}

export function eventCapacity(s: GameState): number {
  return EVENT_BASE_CAPACITY + path(s).eventCapacityBonus + upgradeSum(s, "eventCapacity");
}

export function liveProducts(s: GameState): Product[] {
  return s.products.filter((p) => p.status === "live");
}

export function sellableProducts(s: GameState): Product[] {
  return liveProducts(s).filter((p) => {
    if (p.type === "event") return p.eventDay !== null && p.eventDay > s.day && p.ticketsSold < p.capacity;
    return true;
  });
}

export function cpm(s: GameState): number {
  return BALANCE.baseCpm * upgradeProduct(s, "cpmMult") * modProduct(s, "cpm");
}

export function adFit(s: GameState): number {
  return clamp(BALANCE.adFit + upgradeSum(s, "adFit"), 0.1, 0.9);
}

export function emailSendCost(s: GameState): number {
  if (s.emailList <= BALANCE.emailToolFreeLimit) return 0;
  return Math.round((s.emailList / 1000) * BALANCE.emailToolCostPer1000);
}

/** Daily cost the player will pay given the current plan (excluding product setup). */
export function plannedSpend(s: GameState): number {
  return (
    s.plan.adBudget +
    s.plan.posts * BALANCE.postDataCost +
    (s.plan.email ? emailSendCost(s) : 0) +
    BALANCE.dailyDataCost +
    upgradeSum(s, "dailyCost")
  );
}

export function netRevenue(s: GameState): number {
  return s.totals.grossRevenue - s.totals.refunds;
}

export function netProfit(s: GameState): number {
  const t = s.totals;
  return (
    t.grossRevenue -
    t.refunds -
    t.paymentFees -
    t.affiliateCommissions -
    t.directCosts -
    t.operatingCosts +
    t.otherIncome
  );
}

export function grossProfit(s: GameState): number {
  const t = s.totals;
  return t.grossRevenue - t.refunds - t.paymentFees - t.affiliateCommissions - t.directCosts;
}

export function pendingCash(s: GameState): number {
  return s.pendingPayouts.reduce((a, p) => a + p.amount, 0);
}

export function sideGigPay(s: GameState): number {
  return BALANCE.sideGigPay + s.rank * BALANCE.sideGigPayPerRank;
}

export function activeProductCount(s: GameState): number {
  return s.products.filter((p) => p.status === "live" || p.status === "developing").length;
}

export const MAX_ACTIVE_PRODUCTS = 6;
