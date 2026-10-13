// Day resolution: the heart of the business simulation.
// resolveDay() is a pure function: (state) -> next state. All randomness comes
// from a stream seeded by (seed, day), so identical decisions give identical results.

import { BALANCE } from "../config/balance";
import { EVENTS, addAudience } from "../config/events";
import { TOPICS } from "../config/paths";
import {
  COACHING_HOURS_PER_SESSION,
  COURSE_HOSTING_DAILY,
  EVENT_COST_PER_ATTENDEE,
  EVENT_SALES_DAYS,
  MEMBERSHIP_BASE_CHURN,
  MEMBERSHIP_CYCLE_DAYS,
  PRODUCT_TYPES,
} from "../config/products";
import {
  adFit,
  clamp,
  contentQuality,
  cpm,
  emailSendCost,
  eventCapacity,
  hasUpgradeFlag,
  hoursBreakdown,
  membersOf,
  modProduct,
  modSum,
  path,
  refPrice,
  sellableProducts,
  sideGigPay,
  upgradeProduct,
  upgradeSum,
} from "./economy";
import { checkProgression, finalOutcome } from "./progression";
import { dayRng, lognormal, pickWeighted, sampleCount, type Rng } from "./rng";
import { cloneState, emptyLedger } from "./state";
import type { Channel, ChannelStats, DayReport, GameState, Product } from "./types";

const CHANNELS: Channel[] = ["organic", "ads", "email", "affiliate", "bonus"];

interface Segment {
  channel: Channel;
  visitors: number;
  fit: number;
}

function emptyChannelStats(): Record<Channel, ChannelStats> {
  return Object.fromEntries(CHANNELS.map((c) => [c, { visitors: 0, sales: 0, revenue: 0 }])) as Record<
    Channel,
    ChannelStats
  >;
}

/** Probability that one visitor from a segment buys a product (or downloads a free one). */
export function conversionProbability(s: GameState, p: Product, channel: Channel, segFit: number): number {
  const cfg = PRODUCT_TYPES[p.type];
  const fit = segFit * (p.topic === s.niche ? 1 : BALANCE.offNicheFitPenalty);
  if (p.price === 0) {
    return clamp(BALANCE.freeDownloadConv * (0.4 + fit) * (0.6 + p.quality * 0.4), 0, 0.9);
  }
  const priceFactor = priceResponse(refPrice(s, p.type, p.topic) / p.price, cfg.elasticity);
  const qualityFactor = 0.4 + p.quality * 0.8;
  const repFactor = 0.75 + s.reputation / 200;
  const satFactor = 0.8 + s.satisfaction / 250;
  const topicDemand = TOPICS[p.topic]?.demand ?? 1;
  const proven = p.provenTopic ? BALANCE.provenTopicDemandBoost : 1;
  const mods = modProduct(s, "demand", p.type) * modProduct(s, "conv") * upgradeProduct(s, "convMult");
  const channelConv = (BALANCE.channelConv[channel] ?? 1) * (channel === "email" ? path(s).emailConvMult : 1);
  const prob =
    cfg.baseConversion * fit * priceFactor * qualityFactor * repFactor * satFactor * topicDemand * proven * mods * channelConv;
  return clamp(prob, 0, 0.6);
}

/**
 * Demand response to price. ratio = reference price / price.
 * Below the reference price demand rises with the elasticity; above it, the
 * effective elasticity grows the further you overprice, so extreme prices
 * collapse demand instead of just trading volume for margin.
 */
export function priceResponse(ratio: number, elasticity: number): number {
  if (ratio >= 1) return clamp(Math.pow(ratio, elasticity), 1, 2.5);
  const e = elasticity + 0.8 * Math.log(1 / ratio);
  return clamp(Math.pow(ratio, e), 0.0005, 1);
}

function exposure(s: GameState, p: Product, channel: Channel, productCount: number): number {
  if (productCount <= 1) return 1;
  if (channel === "affiliate" || channel === "email") return 0.6;
  const featured = s.plan.featuredProductId;
  if (featured && s.products.some((x) => x.id === featured && x.status === "live")) {
    return p.id === featured ? BALANCE.featuredExposure : BALANCE.otherExposure;
  }
  return 0.6;
}

function payoutDelay(s: GameState): number {
  let extra = modSum(s, "payoutDelay");
  if (hasUpgradeFlag(s, "payoutProtection")) extra = Math.max(0, extra - 1);
  return BALANCE.payoutDelayDays + extra;
}

function rollEvent(s: GameState): void {
  if (s.day < BALANCE.minEventDay || s.day > s.campaignDays) return;
  if (s.day - s.lastEventDay < 2) return;
  const rng = dayRng(s.seed, s.day, "event");
  if (rng() > BALANCE.eventChance) return;
  const last = s.eventHistory[s.eventHistory.length - 1]?.eventId;
  const candidates = EVENTS.filter((e) => e.minDay <= s.day && e.id !== last && e.weight(s) > 0);
  const ev = pickWeighted(rng, candidates, (e) => e.weight(s));
  if (!ev) return;
  const built = ev.build(s, rng);
  s.pendingEvent = { eventId: ev.id, day: s.day, ...built };
  s.lastEventDay = s.day;
}

export function resolveDay(input: GameState): GameState {
  const s = cloneState(input);
  const rng: Rng = dayRng(s.seed, s.day);
  const P = path(s);
  const B = BALANCE;
  const notes: string[] = [...s.dayLedger.notes];

  const report: DayReport = {
    day: s.day,
    hoursAvailable: 0,
    hoursUsed: 0,
    visitors: { organic: 0, ads: 0, email: 0, affiliate: 0, bonus: 0 },
    salesByProduct: {},
    revenueByProduct: {},
    channelStats: emptyChannelStats(),
    grossRevenue: 0,
    refunds: s.dayLedger.refunds,
    paymentFees: 0,
    affiliateCommissions: 0,
    directCosts: 0,
    operatingCosts: s.dayLedger.operating,
    adSpend: 0,
    otherIncome: s.dayLedger.otherIncome,
    investments: s.dayLedger.investments,
    netProfit: 0,
    payoutsReleased: 0,
    cashStart: s.dayLedger.cashStart,
    cashEnd: 0,
    audienceStart: s.audience,
    audienceEnd: 0,
    newFollowers: 0,
    emailListEnd: 0,
    newSubscribers: 0,
    affiliates: 0,
    reputation: 0,
    satisfaction: 0,
    wellbeing: 0,
    missedCoachingDemand: 0,
    notes,
    devCompleted: [],
    eventsHosted: [],
  };

  // ---- 1. Payouts that settle today -------------------------------------------------
  const due = s.pendingPayouts.filter((p) => p.day <= s.day);
  s.pendingPayouts = s.pendingPayouts.filter((p) => p.day > s.day);
  for (const p of due) {
    s.cash += p.amount;
    report.payoutsReleased += p.amount;
  }

  // ---- 2. Hours ------------------------------------------------------------------------
  const resting = s.plan.rest;
  const hb = hoursBreakdown(s);
  report.hoursAvailable = hb.available;
  let posts = resting ? 0 : s.plan.posts;
  let sendEmail = !resting && s.plan.email && s.emailList > 0;
  let coachingSlots = resting ? 0 : s.plan.coachingSlots;
  let sideGig = !resting && s.plan.sideGig;
  // If something reduced hours after planning, trim optional work.
  let optionalBudget = Math.max(0, hb.available - hb.upkeep - hb.committed);
  const postH = hb.content / Math.max(1, s.plan.posts);
  const need = () =>
    posts * postH + (sendEmail ? B.emailHours : 0) + coachingSlots * COACHING_HOURS_PER_SESSION + (sideGig ? B.sideGigHours : 0);
  while (need() > optionalBudget + 1e-9) {
    if (sideGig) sideGig = false;
    else if (posts > 0) posts--;
    else if (coachingSlots > 0) coachingSlots--;
    else if (sendEmail) sendEmail = false;
    else break;
  }
  if (posts < s.plan.posts && !resting) notes.push("Not enough hours: some planned posts were skipped.");

  // ---- 3. Marketing → visitor segments --------------------------------------------------
  const segments: Segment[] = [];
  const sellable = sellableProducts(s);
  const paidSellable = sellable.filter((p) => p.price > 0);
  const repReach = 0.7 + s.reputation / 100 * 0.6;

  // Organic content
  if (posts > 0) {
    const perPostReach =
      (B.organicBaseReach + s.audience * B.organicReachPerFollower) *
      contentQuality(s) *
      P.organicReachMult *
      (1 + upgradeSum(s, "organicReach")) *
      modProduct(s, "reach") *
      repReach;
    let reach = 0;
    for (let i = 0; i < posts; i++) reach += perPostReach * lognormal(rng, P.organicNoise) * (i === 0 ? 1 : 0.85);
    const visitors = reach * B.organicClickRate;
    segments.push({ channel: "organic", visitors, fit: Math.min(B.maxFit, s.audienceFit + 0.05) });
    const followers = reach * B.organicFollowRate * (0.6 + 0.4 * s.audienceFit);
    const before = s.audience;
    addAudience(s, followers, Math.min(B.maxFit, s.audienceFit + 0.08));
    s.audienceFit = clamp(s.audienceFit + B.fitGainPerPost * posts, 0.05, B.maxFit);
    report.newFollowers += s.audience - before;
    s.postsMade += posts;
  } else {
    s.audience = Math.max(0, Math.round(s.audience * (1 - B.audienceDecayNoPost)));
  }

  // Paid ads
  const adBudget = Math.min(s.plan.adBudget, Math.max(0, s.cash));
  if (adBudget > 0) {
    const saturation = 1 / (1 + adBudget / B.adSaturationBudget);
    const impressions = (adBudget / cpm(s)) * 1000 * saturation;
    const featured = s.products.find((p) => p.id === s.plan.featuredProductId && p.status === "live");
    const fatigue = featured ? featured.adFatigue : average(paidSellable.map((p) => p.adFatigue));
    const ctr = B.adCtr * (1 - clamp(fatigue, 0, 0.7)) * modProduct(s, "reach");
    const visitors = impressions * ctr;
    segments.push({ channel: "ads", visitors, fit: adFit(s) });
    const before = s.audience;
    addAudience(s, visitors * B.adFollowRate, adFit(s));
    report.newFollowers += s.audience - before;
    report.adSpend = adBudget;
    s.adDays++;
    for (const p of featured ? [featured] : paidSellable) p.adFatigue = clamp(p.adFatigue + B.adFatiguePerDay, 0, 0.8);
  }
  for (const p of s.products) {
    if (adBudget > 0 && (p.id === s.plan.featuredProductId || !s.plan.featuredProductId)) continue;
    p.adFatigue = clamp(p.adFatigue - B.adFatigueRecovery, 0, 0.8);
  }

  // Email
  if (sendEmail) {
    const clicks =
      s.emailList * B.emailOpenRate * s.emailFreshness * B.emailClickRate * modProduct(s, "emailBoost") * lognormal(rng, 0.15);
    segments.push({ channel: "email", visitors: clicks, fit: B.emailFit });
    s.emailFreshness = clamp(s.emailFreshness - B.emailFreshnessCostPerSend + upgradeSum(s, "emailFreshnessBonus") * 0.5, 0.2, 1);
    s.emailsSent++;
  } else {
    s.emailFreshness = clamp(s.emailFreshness + B.emailFreshnessRecovery + upgradeSum(s, "emailFreshnessBonus"), 0.2, 1);
  }

  // Affiliates
  if (s.plan.affiliateOn && paidSellable.length > 0) {
    const commission = clamp(s.plan.affiliateCommission, 0.1, 0.6);
    const proof = paidSellable.some((p) => p.sales >= B.affiliateSocialProofSales) ? 1.5 : 0.6;
    const recruit = B.affiliateRecruitBase * (commission / 0.3) * (s.reputation / 50) * proof;
    const cap = Math.max(3, Math.round(s.reputation * B.affiliateMaxPerReputation));
    s.affiliates = Math.min(cap, s.affiliates + sampleCount(rng, recruit));
    s.affiliates = Math.max(0, s.affiliates - sampleCount(rng, s.affiliates * B.affiliateChurn));
    const visitors =
      s.affiliates * B.affiliateVisitors * Math.sqrt(commission / 0.3) * modProduct(s, "affiliateBoost") * lognormal(rng, 0.25);
    if (visitors > 0) segments.push({ channel: "affiliate", visitors, fit: B.affiliateFit });
  } else if (s.affiliates > 0) {
    s.affiliates = Math.floor(s.affiliates * 0.8);
  }

  // Bonus traffic (viral spikes etc.)
  const bonus = modSum(s, "bonusVisitors");
  if (bonus > 0) segments.push({ channel: "bonus", visitors: bonus, fit: 0.35 });

  // ---- 4. Sales -------------------------------------------------------------------------
  const productCount = sellable.length;
  let totalVisitors = 0;
  for (const seg of segments) {
    report.visitors[seg.channel] += Math.round(seg.visitors);
    report.channelStats[seg.channel].visitors += Math.round(seg.visitors);
    totalVisitors += seg.visitors;
  }

  let grossRevenue = 0;
  let paymentFees = 0;
  let affiliateCommissions = 0;
  let paidSalesToday = 0;
  let qualitySalesScore = 0;
  let downloadsToday = 0;
  const commission = clamp(s.plan.affiliateCommission, 0.1, 0.6);
  const delay = payoutDelay(s);

  for (const p of sellable) {
    const byChannel: Partial<Record<Channel, number>> = {};
    let expected = 0;
    for (const seg of segments) {
      const e = seg.visitors * exposure(s, p, seg.channel, productCount) * conversionProbability(s, p, seg.channel, seg.fit);
      byChannel[seg.channel] = (byChannel[seg.channel] ?? 0) + e;
      expected += e;
    }
    // Past customers consider a brand-new paid product on its launch day.
    if (p.price > 0 && p.launchedDay === s.day && s.totals.customers > 0) {
      const e =
        s.totals.customers *
        B.repeatBuyerRate *
        P.repeatBuyerMult *
        (p.topic === s.niche ? 1 : B.offNicheFitPenalty) *
        clamp(Math.pow(refPrice(s, p.type, p.topic) / p.price, 0.8), 0.1, 1.5);
      byChannel.email = (byChannel.email ?? 0) + e;
      expected += e;
    }
    let sales = sampleCount(rng, expected);

    if (p.type === "coaching") {
      if (sales > coachingSlots) {
        report.missedCoachingDemand += sales - coachingSlots;
        sales = coachingSlots;
      }
    }
    if (p.type === "event") sales = Math.min(sales, p.capacity - p.ticketsSold);
    if (sales <= 0) continue;

    // Attribute sales to channels proportionally.
    const attributed = distribute(sales, byChannel);
    if (p.price === 0) {
      downloadsToday += sales;
      p.sales += sales;
      report.salesByProduct[p.id] = sales;
      report.revenueByProduct[p.id] = 0;
      for (const [ch, n] of Object.entries(attributed)) report.channelStats[ch as Channel].sales += n;
      continue;
    }

    const revenue = sales * p.price;
    const affSales = attributed.affiliate ?? 0;
    const commissionPaid = affSales * p.price * commission;
    const fee = revenue * B.paymentFeeRate;
    grossRevenue += revenue;
    paymentFees += fee;
    affiliateCommissions += commissionPaid;
    paidSalesToday += sales;
    qualitySalesScore += sales * (p.quality - 0.55);
    p.sales += sales;
    p.revenue += revenue;
    report.salesByProduct[p.id] = sales;
    report.revenueByProduct[p.id] = revenue;
    for (const [ch, n] of Object.entries(attributed)) {
      report.channelStats[ch as Channel].sales += n;
      report.channelStats[ch as Channel].revenue += n * p.price;
    }
    if (p.type === "membership") p.members.push({ day: s.day, count: sales });
    if (p.type === "event") p.ticketsSold += sales;

    // Schedule refunds for a share of today's sales.
    const cfg = PRODUCT_TYPES[p.type];
    if (cfg.refundRate > 0) {
      const ref = refPrice(s, p.type, p.topic);
      const prob = clamp(
        cfg.refundRate *
          (1.6 - p.quality) *
          Math.pow(p.price / ref, 0.4) *
          upgradeProduct(s, "refundMult") *
          modProduct(s, "refund") *
          (1.3 - s.satisfaction / 200),
        0,
        0.5,
      );
      const refunds = Math.min(sales, sampleCount(rng, sales * prob));
      for (let i = 0; i < refunds; i++) {
        s.scheduledRefunds.push({ day: s.day + 1 + Math.floor(rng() * 3), productId: p.id, amount: p.price });
      }
    }
  }

  // Membership renewals
  let renewalRevenue = 0;
  const upkeepShort = hb.upkeep > hb.available + 0.01 || resting;
  for (const p of s.products.filter((x) => x.type === "membership" && x.status === "live")) {
    for (const cohort of p.members) {
      const age = s.day - cohort.day;
      if (age > 0 && age % MEMBERSHIP_CYCLE_DAYS === 0 && cohort.count > 0) {
        const churnRate = clamp(
          MEMBERSHIP_BASE_CHURN * P.churnMult * (1.6 - s.satisfaction / 100) * (1.35 - p.quality * 0.5) * (upkeepShort ? 1.8 : 1),
          0.02,
          0.8,
        );
        const leaving = Math.min(cohort.count, sampleCount(rng, cohort.count * churnRate));
        cohort.count -= leaving;
        const renewed = cohort.count * p.price;
        renewalRevenue += renewed;
        p.revenue += renewed;
        report.revenueByProduct[p.id] = (report.revenueByProduct[p.id] ?? 0) + renewed;
        if (leaving > 0) notes.push(`${leaving} member(s) left ${p.name}.`);
      }
    }
    p.members = p.members.filter((c) => c.count > 0);
  }
  if (renewalRevenue > 0) {
    grossRevenue += renewalRevenue;
    paymentFees += renewalRevenue * B.paymentFeeRate;
  }

  // Revenue settles into cash after the payout delay.
  const netFromSales = grossRevenue - paymentFees - affiliateCommissions;
  if (netFromSales > 0) s.pendingPayouts.push({ day: s.day + delay, amount: Math.round(netFromSales) });

  // Email list growth: opt-ins, buyers and free downloads.
  const optIns = sampleCount(rng, totalVisitors * B.optInRate * P.optInMult * upgradeProduct(s, "optInMult"));
  const newSubs = optIns + Math.round(paidSalesToday * 0.7) + downloadsToday;
  s.emailList += newSubs;
  report.newSubscribers = newSubs;

  // ---- 5. Events hosted today ----------------------------------------------------------------
  let directCosts = 0;
  for (const p of s.products.filter((x) => x.type === "event" && x.status === "live" && x.eventDay === s.day)) {
    const attendees = p.ticketsSold;
    directCosts += attendees * EVENT_COST_PER_ATTENDEE;
    const fill = p.capacity > 0 ? attendees / p.capacity : 0;
    s.reputation = clamp(s.reputation + (fill - 0.35) * 10 * p.quality, 0, 100);
    s.satisfaction = clamp(s.satisfaction + (p.quality - 0.6) * 10, 0, 100);
    addAudience(s, attendees * 2, 0.9);
    p.status = "completed";
    report.eventsHosted.push(p.name);
    notes.push(`You hosted ${p.name}: ${attendees}/${p.capacity} seats filled.`);
  }

  // ---- 6. Hours, product development, wellbeing -----------------------------------------------
  const optionalUsed = need();
  let freeHours = Math.max(0, hb.available - hb.upkeep - hb.committed - optionalUsed);
  let devUsed = 0;
  if (!resting) {
    for (const p of s.products.filter((x) => x.status === "developing")) {
      if (freeHours <= 0) break;
      const remaining = p.devHoursTotal - p.devHoursDone;
      const work = Math.min(remaining, freeHours);
      p.devHoursDone += work;
      freeHours -= work;
      devUsed += work;
      if (p.devHoursDone >= p.devHoursTotal - 1e-9) {
        p.status = "live";
        p.launchedDay = s.day + 1;
        if (p.type === "coaching" && s.plan.coachingSlots === 0) s.plan.coachingSlots = 1;
        if (p.type === "event") {
          p.capacity = eventCapacity(s);
          p.eventDay = s.day + 1 + EVENT_SALES_DAYS;
        }
        if (!s.plan.featuredProductId || !s.products.some((x) => x.id === s.plan.featuredProductId && x.status === "live")) {
          s.plan.featuredProductId = p.id;
        }
        report.devCompleted.push(p.name);
        notes.push(`${p.name} is ready and goes on sale tomorrow.`);
      }
    }
  }
  report.hoursUsed = Math.round((Math.min(hb.available, hb.upkeep) + hb.committed + optionalUsed + devUsed) * 10) / 10;

  const nonDevLoad = hb.available > 0 ? (hb.upkeep + hb.committed + optionalUsed) / hb.available : 0;
  if (resting) s.wellbeing += B.restWellbeingGain;
  else {
    s.wellbeing += B.normalWellbeingRecovery + upgradeSum(s, "wellbeingRecovery");
    if (s.plan.hustle) s.wellbeing -= B.hustleWellbeingCost;
    if (nonDevLoad > B.overworkThreshold) s.wellbeing -= B.overworkWellbeingCost;
  }
  s.wellbeing = clamp(Math.round(s.wellbeing), 0, 100);

  // ---- 7. Side gig -----------------------------------------------------------------------------
  let otherIncome = 0;
  if (sideGig) {
    otherIncome = sideGigPay(s);
    s.cash += otherIncome;
    s.sideGigs++;
    notes.push(`Side gig paid ₦${otherIncome.toLocaleString()}.`);
  }

  // ---- 8. Operating costs ------------------------------------------------------------------------
  const courseHosting = s.products.filter((p) => p.type === "course" && p.status === "live").length * COURSE_HOSTING_DAILY;
  const opCosts =
    B.dailyDataCost +
    posts * B.postDataCost +
    (sendEmail ? emailSendCost(s) : 0) +
    adBudget +
    upgradeSum(s, "dailyCost") +
    courseHosting;
  s.cash -= opCosts + directCosts;

  // ---- 9. Refunds due today ------------------------------------------------------------------------
  let refundsToday = 0;
  let refundCount = 0;
  const dueRefunds = s.scheduledRefunds.filter((r) => r.day <= s.day);
  s.scheduledRefunds = s.scheduledRefunds.filter((r) => r.day > s.day);
  for (const r of dueRefunds) {
    refundsToday += r.amount;
    refundCount++;
    const p = s.products.find((x) => x.id === r.productId);
    if (p) {
      p.refunds++;
      p.refundedAmount += r.amount;
    }
  }
  s.cash -= refundsToday;

  // ---- 10. Satisfaction & reputation ----------------------------------------------------------------
  const paidLive = s.products.filter((p) => p.status === "live" && p.price > 0);
  const avgQuality = paidLive.length ? average(paidLive.map((p) => p.quality)) : 0.65;
  const supportNeed = paidSalesToday * B.supportHoursPerSale;
  const supportShort = !resting && supportNeed > freeHours + hb.upkeep * 0.5 && paidSalesToday > 20;
  let target = 42 + avgQuality * 42 + upgradeSum(s, "satisfactionTarget");
  if (report.missedCoachingDemand > 0) target -= 4;
  if (supportShort) target -= 8;
  if (upkeepShort && totalMembersOf(s) > 0) target -= 6;
  if (s.wellbeing < B.lowWellbeing) target -= 5;
  if (refundCount > 0 && paidSalesToday > 0) target -= Math.min(10, (refundCount / paidSalesToday) * 40);
  s.satisfaction = clamp(s.satisfaction + (target - s.satisfaction) * B.satisfactionEase, 0, 100);

  let repDelta = Math.min(3, qualitySalesScore * B.reputationPerQualitySale);
  repDelta -= Math.min(4, refundCount * B.reputationRefundPenalty * 0.5);
  repDelta += (s.satisfaction - 60) / 100;
  s.reputation = clamp(s.reputation + repDelta, 0, B.reputationMax);
  s.satisfaction = Math.round(s.satisfaction * 10) / 10;
  s.reputation = Math.round(s.reputation * 10) / 10;

  // ---- 11. Totals & report ----------------------------------------------------------------------------
  const t = s.totals;
  t.grossRevenue += grossRevenue;
  t.refunds += refundsToday + s.dayLedger.refunds;
  t.paymentFees += paymentFees;
  t.affiliateCommissions += affiliateCommissions;
  t.directCosts += directCosts;
  t.operatingCosts += opCosts + s.dayLedger.operating;
  t.adSpend += adBudget;
  t.otherIncome += otherIncome + s.dayLedger.otherIncome;
  t.investments += s.dayLedger.investments;
  t.sales += paidSalesToday;
  t.customers += paidSalesToday;

  s.cash = Math.round(s.cash);
  report.grossRevenue = Math.round(grossRevenue);
  report.refunds = Math.round(refundsToday + s.dayLedger.refunds);
  report.paymentFees = Math.round(paymentFees);
  report.affiliateCommissions = Math.round(affiliateCommissions);
  report.directCosts = Math.round(directCosts);
  report.operatingCosts = Math.round(opCosts + s.dayLedger.operating);
  report.otherIncome = Math.round(otherIncome + s.dayLedger.otherIncome);
  report.netProfit = Math.round(
    report.grossRevenue -
      report.refunds -
      report.paymentFees -
      report.affiliateCommissions -
      report.directCosts -
      report.operatingCosts +
      report.otherIncome,
  );
  report.cashEnd = s.cash;
  report.audienceEnd = s.audience;
  report.emailListEnd = s.emailList;
  report.affiliates = s.affiliates;
  report.reputation = s.reputation;
  report.satisfaction = s.satisfaction;
  report.wellbeing = s.wellbeing;
  s.history.push(report);

  // ---- 12. Modifiers tick, insolvency, progression -----------------------------------------------
  s.modifiers = s.modifiers.map((m) => ({ ...m, daysLeft: m.daysLeft - 1 })).filter((m) => m.daysLeft > 0);
  s.negativeCashDays = s.cash < 0 ? s.negativeCashDays + 1 : 0;
  if (s.cash < 0) notes.push("Your cash is negative. Cut costs or take a side gig before you go insolvent.");
  checkProgression(s);

  // ---- 13. Advance to the next day ------------------------------------------------------------------
  const ended = s.day >= s.campaignDays || s.negativeCashDays >= B.insolvencyDays;
  s.day++;
  s.plan.rest = false;
  s.plan.sideGig = false;
  s.plan.hustle = false;
  s.hoursCommitted = 0;
  s.dayFlags = [];
  if (s.plan.adBudget > Math.max(0, s.cash)) s.plan.adBudget = Math.max(0, Math.floor(s.cash / 500) * 500);
  if (!s.products.some((p) => p.type === "coaching" && p.status === "live")) s.plan.coachingSlots = 0;
  if (s.emailList === 0) s.plan.email = false;

  if (ended) {
    // Settle everything still in flight so the final books are complete.
    const outstanding = s.pendingPayouts.reduce((a, p) => a + p.amount, 0);
    s.cash += outstanding;
    s.pendingPayouts = [];
    const lateRefunds = s.scheduledRefunds.reduce((a, r) => a + r.amount, 0);
    s.cash -= lateRefunds;
    s.totals.refunds += lateRefunds;
    s.scheduledRefunds = [];
    s.day = Math.min(s.day, s.campaignDays);
    s.phase = "ended";
    s.outcome = finalOutcome(s);
    s.dayLedger = emptyLedger(s.cash);
    s.pendingEvent = null;
    return s;
  }

  s.dayLedger = emptyLedger(s.cash);
  rollEvent(s);
  return s;
}

function totalMembersOf(s: GameState): number {
  return s.products.filter((p) => p.type === "membership" && p.status === "live").reduce((a, p) => a + membersOf(p), 0);
}

function average(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Split an integer total across weighted buckets (largest remainder). */
export function distribute(total: number, weights: Partial<Record<Channel, number>>): Partial<Record<Channel, number>> {
  const entries = Object.entries(weights).filter(([, w]) => (w ?? 0) > 0) as [Channel, number][];
  const sum = entries.reduce((a, [, w]) => a + w, 0);
  const out: Partial<Record<Channel, number>> = {};
  if (sum <= 0 || total <= 0) {
    if (total > 0) out.organic = total;
    return out;
  }
  let assigned = 0;
  const rema: [Channel, number][] = [];
  for (const [ch, w] of entries) {
    const exact = (total * w) / sum;
    const base = Math.floor(exact);
    out[ch] = base;
    assigned += base;
    rema.push([ch, exact - base]);
  }
  rema.sort((a, b) => b[1] - a[1]);
  for (let i = 0; assigned < total; i++, assigned++) {
    const ch = rema[i % rema.length]![0];
    out[ch] = (out[ch] ?? 0) + 1;
  }
  return out;
}
