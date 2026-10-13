// Expected-value forecast for today's plan (no randomness). Used by the UI to
// preview decisions; mirrors the formulas in simulate.ts.

import { BALANCE } from "../config/balance";
import {
  adFit,
  clamp,
  contentQuality,
  cpm,
  modProduct,
  modSum,
  path,
  sellableProducts,
  upgradeProduct,
  upgradeSum,
} from "./economy";
import { conversionProbability } from "./simulate";
import type { Channel, GameState } from "./types";

export interface Forecast {
  visitors: Record<Channel, number>;
  totalVisitors: number;
  sales: Record<string, number>;
  revenue: number;
  adRevenue: number;
  followers: number;
  subscribers: number;
}

export function forecastDay(s: GameState): Forecast {
  const B = BALANCE;
  const P = path(s);
  const visitors: Record<Channel, number> = { organic: 0, ads: 0, email: 0, affiliate: 0, bonus: 0 };
  const fits: Record<Channel, number> = { organic: 0, ads: adFit(s), email: B.emailFit, affiliate: B.affiliateFit, bonus: 0.35 };
  let followers = 0;
  const resting = s.plan.rest;
  const sellable = sellableProducts(s);
  const paid = sellable.filter((p) => p.price > 0);

  if (!resting && s.plan.posts > 0) {
    const perPost =
      (B.organicBaseReach + s.audience * B.organicReachPerFollower) *
      contentQuality(s) *
      P.organicReachMult *
      (1 + upgradeSum(s, "organicReach")) *
      modProduct(s, "reach") *
      (0.7 + (s.reputation / 100) * 0.6);
    let reach = 0;
    for (let i = 0; i < s.plan.posts; i++) reach += perPost * (i === 0 ? 1 : 0.85);
    visitors.organic = reach * B.organicClickRate;
    fits.organic = Math.min(B.maxFit, s.audienceFit + 0.05);
    followers += reach * B.organicFollowRate * (0.6 + 0.4 * s.audienceFit);
  }
  const adBudget = Math.min(s.plan.adBudget, Math.max(0, s.cash));
  if (adBudget > 0) {
    const sat = 1 / (1 + adBudget / B.adSaturationBudget);
    const featured = s.products.find((p) => p.id === s.plan.featuredProductId && p.status === "live");
    const fatigue = featured ? featured.adFatigue : paid.length ? paid.reduce((a, p) => a + p.adFatigue, 0) / paid.length : 0;
    visitors.ads = (adBudget / cpm(s)) * 1000 * sat * B.adCtr * (1 - clamp(fatigue, 0, 0.7)) * modProduct(s, "reach");
    followers += visitors.ads * B.adFollowRate;
  }
  if (!resting && s.plan.email && s.emailList > 0) {
    visitors.email = s.emailList * B.emailOpenRate * s.emailFreshness * B.emailClickRate * modProduct(s, "emailBoost");
  }
  if (s.plan.affiliateOn && paid.length > 0) {
    visitors.affiliate = s.affiliates * B.affiliateVisitors * Math.sqrt(clamp(s.plan.affiliateCommission, 0.1, 0.6) / 0.3) * modProduct(s, "affiliateBoost");
  }
  visitors.bonus = modSum(s, "bonusVisitors");

  const sales: Record<string, number> = {};
  let revenue = 0;
  let adRevenue = 0;
  const count = sellable.length;
  for (const p of sellable) {
    let e = 0;
    for (const ch of Object.keys(visitors) as Channel[]) {
      if (!visitors[ch]) continue;
      let exp = 1;
      if (count > 1) {
        if (ch === "affiliate" || ch === "email") exp = 0.6;
        else if (s.plan.featuredProductId && s.products.some((x) => x.id === s.plan.featuredProductId && x.status === "live"))
          exp = p.id === s.plan.featuredProductId ? B.featuredExposure : B.otherExposure;
        else exp = 0.6;
      }
      const v = visitors[ch] * exp * conversionProbability(s, p, ch, fits[ch]);
      e += v;
      if (ch === "ads") adRevenue += v * p.price;
    }
    if (p.type === "coaching") e = Math.min(e, resting ? 0 : s.plan.coachingSlots);
    if (p.type === "event") e = Math.min(e, p.capacity - p.ticketsSold);
    sales[p.id] = e;
    revenue += e * p.price;
  }
  const totalVisitors = Object.values(visitors).reduce((a, b) => a + b, 0);
  const subscribers = totalVisitors * B.optInRate * P.optInMult * upgradeProduct(s, "optInMult");
  return { visitors, totalVisitors, sales, revenue, adRevenue, followers, subscribers };
}
