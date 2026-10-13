import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/config/balance";
import { PATHS, PATH_ORDER } from "../src/config/paths";
import { PRODUCT_TYPES } from "../src/config/products";
import { act, applyAction } from "../src/engine/actions";
import { hoursAvailable, hoursBreakdown, isProductTypeUnlocked, netProfit, netRevenue, pendingCash, refPrice } from "../src/engine/economy";
import { dayRng, mulberry32, sampleCount } from "../src/engine/rng";
import { distribute } from "../src/engine/simulate";
import { createNewGame } from "../src/engine/state";
import { endDays, launch, newGame, tweak } from "./helpers";

describe("rng", () => {
  it("is deterministic per seed and day", () => {
    const a = dayRng(7, 3);
    const b = dayRng(7, 3);
    const c = dayRng(7, 4);
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    expect(c()).not.toEqual(xs[0]);
  });
  it("sampleCount has the right mean", () => {
    const r = mulberry32(1);
    for (const mean of [0.5, 4, 80]) {
      let sum = 0;
      for (let i = 0; i < 4000; i++) sum += sampleCount(r, mean);
      expect(sum / 4000).toBeGreaterThan(mean * 0.9);
      expect(sum / 4000).toBeLessThan(mean * 1.1);
    }
    expect(sampleCount(r, 0)).toBe(0);
    expect(sampleCount(r, -3)).toBe(0);
  });
  it("distribute splits an integer total exactly", () => {
    const d = distribute(7, { organic: 1, ads: 1, email: 2 });
    expect(Object.values(d).reduce((a, b) => a + (b ?? 0), 0)).toBe(7);
  });
});

describe("new game and creator paths", () => {
  it("starts with ₦5,000 and a 30-day campaign", () => {
    const s = newGame();
    expect(s.cash).toBe(5_000);
    expect(s.campaignDays).toBe(30);
    expect(s.day).toBe(1);
  });
  it("each path changes starting attributes and early products", () => {
    const sigs = PATH_ORDER.map((p) => {
      const s = createNewGame({ seed: 1, path: p });
      return JSON.stringify([s.audience, s.audienceFit, s.reputation, s.emailList, PATHS[p].earlyProducts]);
    });
    expect(new Set(sigs).size).toBe(5);
    // Community path can launch memberships immediately; knowledge can't.
    expect(isProductTypeUnlocked(newGame("community"), "membership")).toBe(true);
    expect(isProductTypeUnlocked(newGame("knowledge"), "membership")).toBe(false);
    // But nothing is permanently locked: rank unlocks it.
    expect(isProductTypeUnlocked(tweak(newGame("knowledge"), (d) => (d.rank = 2)), "membership")).toBe(true);
  });
  it("paths have functionally different simulation outcomes", () => {
    const runs = PATH_ORDER.map((p) => {
      let s = createNewGame({ seed: 9, path: p });
      s = act(s, { type: "setPlan", plan: { posts: 2 } });
      s = endDays(s, 3);
      return s.audience;
    });
    expect(new Set(runs).size).toBeGreaterThan(3);
  });
  it("coach sessions are worth more on the coach path", () => {
    const c = newGame("coach");
    const k = newGame("knowledge");
    expect(refPrice(c, "coaching", "career")).toBeGreaterThan(refPrice(k, "coaching", "career"));
  });
});

describe("products and pricing", () => {
  it("validates price ranges, unlocks and cash", () => {
    const s = newGame("knowledge");
    expect(applyAction(s, { type: "createProduct", productType: "ebook", topic: "career", price: 100, effort: "standard" }).ok).toBe(false);
    expect(applyAction(s, { type: "createProduct", productType: "ebook", topic: "career", price: 999_999, effort: "standard" }).ok).toBe(false);
    expect(applyAction(s, { type: "createProduct", productType: "membership", topic: "career", price: 1_000, effort: "standard" }).ok).toBe(false);
    expect(applyAction(s, { type: "createProduct", productType: "course", topic: "career", price: 0, effort: "standard" }).ok).toBe(false);
    const poor = tweak(s, (d) => (d.cash = 100));
    expect(applyAction(poor, { type: "createProduct", productType: "ebook", topic: "career", price: 2_000, effort: "standard" }).ok).toBe(false);
    const r = applyAction(s, { type: "createProduct", productType: "ebook", topic: "career", price: 2_000, effort: "standard" });
    expect(r.ok).toBe(true);
    expect(r.state.cash).toBe(5_000 - PRODUCT_TYPES.ebook.setupCost);
    expect(r.state.products[0]!.status).toBe("developing");
  });
  it("products take hours to build, then go live", () => {
    let s = newGame("writer");
    s = launch(s, "ebook", 2_000);
    const p = s.products[0]!;
    expect(p.status).toBe("live");
    expect(p.devHoursDone).toBeGreaterThanOrEqual(p.devHoursTotal);
  });
  it("premium effort takes longer and gives higher quality", () => {
    const s = newGame("knowledge");
    const a = act(s, { type: "createProduct", productType: "ebook", topic: "career", price: 2_000, effort: "standard" }).products[0]!;
    const b = act(s, { type: "createProduct", productType: "ebook", topic: "career", price: 2_000, effort: "premium" }).products[0]!;
    expect(b.devHoursTotal).toBeGreaterThan(a.devHoursTotal);
    expect(b.quality).toBeGreaterThan(a.quality);
  });
  it("higher prices lower conversion", async () => {
    const { conversionProbability } = await import("../src/engine/simulate");
    let s = launch(newGame("knowledge"), "ebook", 2_500);
    const p = s.products[0]!;
    const low = conversionProbability(s, { ...p, price: 1_000 }, "organic", 0.7);
    const high = conversionProbability(s, { ...p, price: 10_000 }, "organic", 0.7);
    expect(low).toBeGreaterThan(high * 3);
    s = tweak(s, (d) => (d.niche = "finance"));
    expect(conversionProbability(s, p, "organic", 0.7)).toBeLessThan(conversionProbability(tweak(s, (d) => (d.niche = "career")), p, "organic", 0.7));
  });
  it("only one event at a time and ticket price locks after sales", () => {
    let s = tweak(newGame("community"), (d) => (d.cash = 50_000));
    s = act(s, { type: "createProduct", productType: "event", topic: "techcommunity", price: 3_000, effort: "standard" });
    expect(applyAction(s, { type: "createProduct", productType: "event", topic: "techcommunity", price: 3_000, effort: "standard" }).ok).toBe(false);
    s = tweak(s, (d) => {
      d.products[0]!.status = "live";
      d.products[0]!.ticketsSold = 2;
      d.products[0]!.capacity = 30;
      d.products[0]!.eventDay = d.day + 3;
    });
    expect(applyAction(s, { type: "setPrice", productId: "p1", price: 4_000 }).ok).toBe(false);
    expect(applyAction(s, { type: "retireProduct", productId: "p1" }).ok).toBe(false);
  });
  it("improving a product raises quality once per day and costs hours", () => {
    let s = launch(newGame("knowledge"), "ebook", 2_500);
    s = tweak(s, (d) => (d.cash = 20_000));
    const before = s.products[0]!.quality;
    s = act(s, { type: "improveProduct", productId: "p1" });
    expect(s.products[0]!.quality).toBeGreaterThan(before);
    expect(s.hoursCommitted).toBe(BALANCE.improveHours);
    expect(applyAction(s, { type: "improveProduct", productId: "p1" }).ok).toBe(false);
  });
  it("proven topics make related products cheaper and faster", async () => {
    const { setupCostFor, devHoursFor } = await import("../src/engine/economy");
    const s = tweak(launch(newGame("knowledge"), "ebook", 2_500), (d) => (d.products[0]!.sales = 20));
    const fresh = newGame("knowledge");
    expect(setupCostFor(s, "template", "career")).toBeLessThan(setupCostFor(fresh, "template", "career"));
    expect(devHoursFor(s, "template", "standard", "career")).toBeLessThan(devHoursFor(fresh, "template", "standard", "career"));
  });
});

describe("day resolution", () => {
  it("rejects duplicate or stale day resolution", () => {
    const s = newGame();
    const next = act(s, { type: "endDay", expectedDay: 1 });
    expect(next.day).toBe(2);
    expect(applyAction(next, { type: "endDay", expectedDay: 1 }).ok).toBe(false);
    expect(next.history).toHaveLength(1);
  });
  it("is reproducible: same seed and decisions give the same result", () => {
    const play = () => {
      let s = launch(newGame("video", 1234), "template", 2_000);
      s = act(s, { type: "setPlan", plan: { posts: 2, adBudget: 1_000 } });
      return endDays(s, 10);
    };
    expect(JSON.stringify(play())).toBe(JSON.stringify(play()));
  });
  it("blocks ending the day while an event is pending", () => {
    let s = newGame();
    s = tweak(s, (d) => {
      d.pendingEvent = { eventId: "power-cut", day: 1, title: "x", description: "x", params: {}, choices: [{ id: "workaround", label: "", description: "", cost: 0 }] };
    });
    expect(applyAction(s, { type: "endDay", expectedDay: 1 }).ok).toBe(false);
    s = act(s, { type: "resolveEvent", choiceId: "workaround" });
    expect(hoursAvailable(s)).toBe(hoursAvailable(newGame()) - 4);
    expect(applyAction(s, { type: "endDay", expectedDay: 1 }).ok).toBe(true);
  });
  it("revenue settles into cash the next day (revenue is not cash)", () => {
    let s = launch(newGame("writer", 77), "ebook", 1_500);
    s = act(s, { type: "setPlan", plan: { posts: 3, email: true } });
    for (let i = 0; i < 15; i++) {
      s = endDays(s, 1);
      const r = s.history[s.history.length - 1]!;
      if (r.grossRevenue > 0) {
        expect(pendingCash(s)).toBeGreaterThan(0);
        return;
      }
    }
    throw new Error("expected at least one sale");
  });
  it("keeps the books consistent: cash = start + profit − investments − unsettled", () => {
    let s = launch(newGame("knowledge", 5), "ebook", 2_500);
    s = act(s, { type: "setPlan", plan: { posts: 2, affiliateOn: true, affiliateCommission: 0.4 } });
    for (let i = 0; i < 12; i++) {
      s = endDays(s, 1);
      const expected = BALANCE.startingCash + netProfit(s) - s.totals.investments - pendingCash(s);
      expect(Math.abs(s.cash - expected)).toBeLessThanOrEqual(s.history.length + 2); // rounding only
      // Planning-phase spending is booked when the day resolves.
      if (s.cash > 6_000 && !s.upgrades.includes("ringlight")) s = act(s, { type: "buyUpgrade", upgradeId: "ringlight" });
    }
  });
  it("prevents spending beyond available cash", () => {
    const s = newGame();
    expect(applyAction(s, { type: "setPlan", plan: { adBudget: 50_000 } }).ok).toBe(false);
    expect(applyAction(s, { type: "setPlan", plan: { adBudget: 2_000 } }).ok).toBe(true);
  });
  it("prevents planning more hours than available", () => {
    let s = newGame("knowledge");
    expect(applyAction(s, { type: "setPlan", plan: { posts: 3, sideGig: true } }).ok).toBe(false);
    s = act(s, { type: "setPlan", plan: { posts: 3 } });
    expect(hoursBreakdown(s).planned).toBeLessThanOrEqual(hoursBreakdown(s).available);
  });
  it("rest days restore wellbeing; hustle drains it", () => {
    const base = tweak(newGame(), (d) => (d.wellbeing = 50));
    const rested = endDays(act(base, { type: "setPlan", plan: { rest: true } }), 1);
    const hustled = endDays(act(base, { type: "setPlan", plan: { hustle: true } }), 1);
    expect(rested.wellbeing).toBeGreaterThan(80);
    expect(hustled.wellbeing).toBeLessThan(50);
  });
  it("side gigs pay cash as a recovery option", () => {
    const s = endDays(act(newGame(), { type: "setPlan", plan: { posts: 0, sideGig: true } }), 1);
    expect(s.cash).toBeGreaterThan(5_000);
    expect(s.totals.otherIncome).toBeGreaterThan(0);
  });
});

describe("marketing channels", () => {
  const live = () => tweak(launch(newGame("knowledge", 3), "ebook", 2_500), (d) => (d.cash = 100_000));
  it("ads buy visitors at a cost and fatigue the creative", () => {
    let s = act(live(), { type: "setPlan", plan: { posts: 0, adBudget: 5_000 } });
    const cash = s.cash;
    s = endDays(s, 1);
    const r = s.history[s.history.length - 1]!;
    expect(r.visitors.ads).toBeGreaterThan(50);
    expect(r.adSpend).toBe(5_000);
    expect(s.products[0]!.adFatigue).toBeGreaterThan(0);
    expect(cash - s.cash).toBeGreaterThan(0 - r.payoutsReleased - 1);
  });
  it("ads have diminishing returns", async () => {
    const { forecastDay } = await import("../src/engine/forecast");
    const s = live();
    const v1 = forecastDay(act(s, { type: "setPlan", plan: { adBudget: 5_000 } })).visitors.ads;
    const v10 = forecastDay(act(s, { type: "setPlan", plan: { adBudget: 50_000 } })).visitors.ads;
    expect(v10).toBeLessThan(v1 * 10 * 0.8);
  });
  it("email sends convert subscribers and tire the list", () => {
    let s = tweak(live(), (d) => (d.emailList = 2_000));
    s = act(s, { type: "setPlan", plan: { posts: 0, email: true } });
    s = endDays(s, 1);
    expect(s.history[s.history.length - 1]!.visitors.email).toBeGreaterThan(50);
    expect(s.emailFreshness).toBeLessThan(1);
  });
  it("affiliates recruit over time and earn commission", () => {
    let s = tweak(live(), (d) => {
      d.reputation = 70;
      d.products[0]!.sales = 20;
    });
    s = act(s, { type: "setPlan", plan: { posts: 0, affiliateOn: true, affiliateCommission: 0.5 } });
    s = endDays(s, 8);
    expect(s.affiliates).toBeGreaterThan(3);
    expect(s.totals.affiliateCommissions).toBeGreaterThan(0);
  });
  it("organic posts grow audience and audience fit", () => {
    let s = act(newGame("writer"), { type: "setPlan", plan: { posts: 3 } });
    const before = s.audience;
    s = endDays(s, 5);
    expect(s.audience).toBeGreaterThan(before);
    expect(s.postsMade).toBe(15);
  });
  it("a smaller, relevant audience beats a big, random one", () => {
    const play = (audience: number, fit: number) => {
      let s = tweak(launch(newGame("knowledge", 21), "ebook", 2_500), (d) => {
        d.audience = audience;
        d.audienceFit = fit;
      });
      s = act(s, { type: "setPlan", plan: { posts: 3 } });
      return netRevenue(endDays(s, 5));
    };
    expect(play(4_000, 0.9)).toBeGreaterThan(play(20_000, 0.1));
  });
  it("a big audience with the wrong offer and heavy ads loses money", () => {
    let s = tweak(newGame("video", 8), (d) => {
      d.audience = 50_000;
      d.audienceFit = 0.1;
      d.cash = 400_000;
    });
    s = act(s, { type: "createProduct", productType: "course", topic: "travel", price: 150_000, effort: "standard" });
    s = tweak(s, (d) => {
      d.products[0]!.status = "live";
      d.products[0]!.launchedDay = d.day;
    });
    s = act(s, { type: "setPlan", plan: { posts: 3, adBudget: 30_000 } });
    s = endDays(s, 5);
    expect(netProfit(s)).toBeLessThan(0);
  });
  it("overpricing far above the market collapses revenue", async () => {
    const { priceResponse } = await import("../src/engine/simulate");
    // revenue per visitor ∝ priceResponse(ratio) / ratio
    const rev = (ratio: number) => priceResponse(ratio, 1.0) / ratio;
    expect(rev(1)).toBeCloseTo(1);
    expect(rev(0.5)).toBeLessThan(1); // 2x price
    expect(rev(0.1)).toBeLessThan(0.05); // 10x price
  });
  it("a free lead magnet grows the email list", () => {
    let s = launch(newGame("writer", 4), "template", 0);
    const list = s.emailList;
    s = act(s, { type: "setPlan", plan: { posts: 3 } });
    s = endDays(s, 3);
    expect(s.emailList).toBeGreaterThan(list + 20);
    expect(s.totals.grossRevenue).toBe(0);
  });
});

describe("fulfilment: coaching, memberships, events", () => {
  it("coaching sales are capped by the slots you offer", () => {
    let s = tweak(launch(newGame("coach", 11), "coaching", 15_000), (d) => {
      d.audience = 20_000;
      d.audienceFit = 0.9;
      d.reputation = 90;
      d.cash = 100_000;
    });
    s = act(s, { type: "setPlan", plan: { posts: 3, coachingSlots: 1, adBudget: 20_000 } });
    s = endDays(s, 3);
    for (const r of s.history.slice(-3)) {
      expect(r.salesByProduct.p1 ?? 0).toBeLessThanOrEqual(1);
    }
    expect(s.history.slice(-3).some((r) => r.missedCoachingDemand > 0)).toBe(true);
  });
  it("memberships renew weekly with churn", () => {
    let s = tweak(launch(newGame("community", 5), "membership", 1_000), (d) => {
      d.products[0]!.members = [{ day: d.day - 7, count: 100 }];
    });
    s = act(s, { type: "setPlan", plan: { posts: 0 } });
    s = endDays(s, 1);
    const members = s.products[0]!.members.reduce((a, m) => a + m.count, 0);
    expect(members).toBeLessThan(110);
    expect(members).toBeGreaterThan(50);
    expect(s.history[s.history.length - 1]!.revenueByProduct.p1).toBeGreaterThan(40_000);
  });
  it("events sell up to capacity, then are hosted with venue costs", () => {
    let s = launch(newGame("community", 6), "event", 2_000);
    const ev = s.products[0]!;
    expect(ev.eventDay).not.toBeNull();
    expect(ev.capacity).toBeGreaterThan(0);
    s = act(s, { type: "setPlan", plan: { posts: 3, email: true } });
    while (s.phase === "planning" && s.day <= (ev.eventDay ?? 0)) s = endDays(s, 1);
    const hosted = s.products[0]!;
    expect(hosted.status).toBe("completed");
    expect(hosted.ticketsSold).toBeLessThanOrEqual(hosted.capacity);
    if (hosted.ticketsSold > 0) expect(s.totals.directCosts).toBeGreaterThan(0);
  });
  it("can't rest on the day you host an event", () => {
    const s = tweak(launch(newGame("community", 6), "event", 2_000), (d) => (d.products[0]!.eventDay = d.day));
    expect(applyAction(s, { type: "setPlan", plan: { rest: true } }).ok).toBe(false);
  });
});

describe("upgrades", () => {
  it("can't be bought twice, needs rank and cash", () => {
    let s = tweak(newGame(), (d) => (d.cash = 200_000));
    s = act(s, { type: "buyUpgrade", upgradeId: "ringlight" });
    expect(applyAction(s, { type: "buyUpgrade", upgradeId: "ringlight" }).ok).toBe(false);
    expect(applyAction(s, { type: "buyUpgrade", upgradeId: "camera" }).ok).toBe(false); // rank
    expect(applyAction(tweak(newGame(), (d) => (d.rank = 2)), { type: "buyUpgrade", upgradeId: "camera" }).ok).toBe(false); // cash
    expect(applyAction(s, { type: "buyUpgrade", upgradeId: "nope" }).ok).toBe(false);
  });
  it("every upgrade changes the simulation", async () => {
    const { UPGRADES } = await import("../src/config/upgrades");
    for (const u of UPGRADES) expect(Object.keys(u.effects).length).toBeGreaterThan(0);
    const base = tweak(newGame(), (d) => (d.rank = 5));
    const chair = tweak(base, (d) => d.upgrades.push("chair"));
    expect(hoursAvailable(chair)).toBe(hoursAvailable(base) + 2);
    const { contentQuality, cpm, adFit } = await import("../src/engine/economy");
    expect(contentQuality(tweak(base, (d) => d.upgrades.push("ringlight")))).toBeGreaterThan(contentQuality(base));
    const ads = tweak(base, (d) => d.upgrades.push("adskills"));
    expect(cpm(ads)).toBeLessThan(cpm(base));
    expect(adFit(ads)).toBeGreaterThan(adFit(base));
  });
  it("there are at least eight upgrades covering every category", async () => {
    const { UPGRADES } = await import("../src/config/upgrades");
    expect(UPGRADES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(UPGRADES.map((u) => u.category))).toEqual(new Set(["productivity", "workspace", "marketing", "quality", "support"]));
  });
});

describe("campaign end", () => {
  it("ends after 30 days with an outcome and settles pending money", () => {
    const s = endDays(tweak(newGame(), (d) => (d.cash = 50_000)), 40);
    expect(s.phase).toBe("ended");
    expect(s.history).toHaveLength(30);
    expect(s.outcome).not.toBeNull();
    expect(s.pendingPayouts).toHaveLength(0);
    expect(applyAction(s, { type: "endDay", expectedDay: s.day }).ok).toBe(false);
  });
  it("insolvency ends the campaign early", () => {
    let s = tweak(newGame(), (d) => (d.cash = -5_000));
    s = act(s, { type: "setPlan", plan: { posts: 0 } });
    s = endDays(s, 5);
    expect(s.phase).toBe("ended");
    expect(s.outcome).toBe("insolvent");
    expect(s.history.length).toBe(BALANCE.insolvencyDays);
  });
  it("net revenue drives rank", () => {
    const s = endDays(tweak(newGame(), (d) => (d.totals.grossRevenue = 260_000)), 1);
    expect(s.rank).toBe(2);
    expect(netRevenue(s)).toBeGreaterThanOrEqual(250_000);
  });
});
