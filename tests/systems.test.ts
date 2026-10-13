import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/config/balance";
import { EVENTS } from "../src/config/events";
import { OBJECTIVES } from "../src/config/objectives";
import { RANKS } from "../src/config/ranks";
import { STORIES } from "../src/config/stories";
import { act, applyAction } from "../src/engine/actions";
import { netProfit } from "../src/engine/economy";
import { forecastDay } from "../src/engine/forecast";
import { checkProgression, rankForRevenue, winCheck } from "../src/engine/progression";
import { mulberry32 } from "../src/engine/rng";
import { computeScore } from "../src/engine/scoring";
import { deserialize, loadGame, saveGame, serialize, validateState, type StorageLike } from "../src/persistence/save";
import { LocalPlatform } from "../src/platform/platform";
import { endDays, launch, newGame, tweak } from "./helpers";

function memoryStorage(): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k] };
}

/** A rich mid-game state where most events are eligible. */
function richState() {
  let s = launch(newGame("video", 99), "template", 2_500);
  s = tweak(s, (d) => {
    d.day = 8;
    d.history = d.history.slice(0, 7);
    while (d.history.length < 7) d.history.push({ ...d.history[0]! });
    d.cash = 60_000;
    d.audience = 3_000;
    d.reputation = 50;
    d.postsMade = 10;
    d.adDays = 3;
    d.totals.sales = 20;
    d.products[0]!.sales = 20;
    d.wellbeing = 40;
    d.lastEventDay = 0;
  });
  return s;
}

describe("events", () => {
  it("has at least eight event types across the PRD categories", () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(8);
    const cats = new Set(EVENTS.map((e) => e.category));
    for (const c of ["viral", "ads", "affiliate", "refund", "competitor", "feedback", "expense", "seasonal", "infrastructure"]) expect(cats.has(c as never)).toBe(true);
  });
  it("every event is fair: always a no-cash option, and every choice applies cleanly", () => {
    const base = richState();
    for (const ev of EVENTS) {
      const w = ev.weight(base);
      if (w <= 0) continue;
      const built = ev.build(base, mulberry32(5));
      expect(built.choices.some((c) => c.cost === 0)).toBe(true);
      for (const choice of built.choices) {
        const s = tweak(base, (d) => {
          d.pendingEvent = { eventId: ev.id, day: d.day, ...built };
        });
        const r = applyAction(s, { type: "resolveEvent", choiceId: choice.id });
        expect(r.ok, `${ev.id}/${choice.id}: ${r.error}`).toBe(true);
        expect(r.state.pendingEvent).toBeNull();
        expect(r.state.cash).toBe(s.cash - choice.cost);
        expect(validateState(r.state)).toEqual([]);
        // The day can still be resolved afterwards.
        expect(applyAction(r.state, { type: "endDay", expectedDay: r.state.day }).ok).toBe(true);
      }
    }
  });
  it("events are recoverable even when broke", () => {
    const broke = tweak(richState(), (d) => (d.cash = -2_000));
    for (const ev of EVENTS) {
      if (ev.weight(broke) <= 0) continue;
      const built = ev.build(broke, mulberry32(1));
      const s = tweak(broke, (d) => (d.pendingEvent = { eventId: ev.id, day: d.day, ...built }));
      const free = built.choices.find((c) => c.cost === 0 && !c.hoursCost) ?? built.choices.find((c) => c.cost === 0)!;
      expect(applyAction(s, { type: "resolveEvent", choiceId: free.id }).ok, ev.id).toBe(true);
    }
  });
  it("events occur during a campaign and are recorded", () => {
    const s = endDays(tweak(newGame("video", 3), (d) => (d.cash = 40_000)), 30);
    expect(s.eventHistory.length).toBeGreaterThan(2);
  });
  it("backup power removes power-cut events", () => {
    const s = tweak(richState(), (d) => d.upgrades.push("inverter"));
    expect(EVENTS.find((e) => e.id === "power-cut")!.weight(s)).toBe(0);
  });
});

describe("progression", () => {
  it("rank thresholds follow the PRD values", () => {
    expect(RANKS.map((r) => r.threshold)).toEqual([0, 50_000, 250_000, 1_000_000, 5_000_000, 20_000_000]);
    expect(RANKS.map((r) => r.name)).toEqual(["Beginner", "Side Hustler", "Growing Creator", "Digital Entrepreneur", "Creator Boss", "Digital Mogul"]);
    expect(rankForRevenue(49_999)).toBe(0);
    expect(rankForRevenue(5_000_000)).toBe(4);
  });
  it("rank-ups, first-sale milestone, objectives and stories fire once", () => {
    const s = tweak(newGame(), (d) => {
      d.totals.grossRevenue = 1_200_000;
      d.totals.sales = 5;
      d.products.push({ ...launch(newGame(), "ebook", 2_000).products[0]! });
    });
    checkProgression(s);
    expect(s.rank).toBe(3);
    expect(s.milestones).toContain("first-sale");
    expect(s.inbox.filter((i) => i.kind === "rank")).toHaveLength(3);
    const before = s.inbox.length;
    checkProgression(s);
    expect(s.inbox.length).toBe(before);
    expect(s.objectives.find((o) => o.id === "first-product")!.done).toBe(true);
  });
  it("objectives give their rewards", () => {
    let s = newGame();
    s = act(s, { type: "createProduct", productType: "ebook", topic: s.niche, price: 2_000, effort: "standard" });
    expect(s.objectives.find((o) => o.id === "first-product")!.done).toBe(true);
    expect(s.reputation).toBe(newGame().reputation + 2);
  });
  it("there are enough objectives and stories, all referencing valid stories", () => {
    expect(OBJECTIVES.length).toBeGreaterThanOrEqual(8);
    const ids = new Set(STORIES.map((x) => x.id));
    for (const o of OBJECTIVES) if (o.reward.story) expect(ids.has(o.reward.story)).toBe(true);
  });
  it("revenue at a loss does not win", () => {
    const s = tweak(newGame(), (d) => {
      d.rank = 3;
      d.totals.grossRevenue = 2_000_000;
      d.totals.adSpend = 3_000_000;
      d.totals.operatingCosts = 3_000_000;
      d.satisfaction = 90;
    });
    expect(netProfit(s)).toBeLessThan(0);
    expect(winCheck(s).won).toBe(false);
    const ok = tweak(s, (d) => (d.totals.operatingCosts = 100_000));
    expect(winCheck(ok).won).toBe(true);
  });
  it("satisfaction is part of the win condition", () => {
    const s = tweak(newGame(), (d) => {
      d.rank = 3;
      d.totals.grossRevenue = 2_000_000;
      d.satisfaction = BALANCE.winMinSatisfaction - 1;
    });
    expect(winCheck(s).won).toBe(false);
  });
});

describe("scoring", () => {
  it("rewards profit above revenue", () => {
    const a = tweak(newGame(), (d) => {
      d.totals.grossRevenue = 1_000_000;
      d.totals.operatingCosts = 1_200_000;
    });
    const b = tweak(newGame(), (d) => {
      d.totals.grossRevenue = 500_000;
      d.totals.operatingCosts = 100_000;
    });
    expect(computeScore(b).total).toBeGreaterThan(computeScore(a).total);
  });
  it("is non-negative and graded", () => {
    const sc = computeScore(tweak(newGame(), (d) => (d.outcome = "insolvent")));
    expect(sc.total).toBeGreaterThanOrEqual(0);
    expect(["S", "A", "B", "C", "D"]).toContain(sc.grade);
  });
});

describe("persistence", () => {
  it("round-trips a mid-campaign save exactly", () => {
    const s = endDays(launch(newGame("community", 12), "membership", 1_000), 3);
    const st = memoryStorage();
    expect(saveGame(s, st)).toBe(true);
    const r = loadGame(st);
    expect(r.status).toBe("ok");
    expect(JSON.stringify(r.state)).toBe(JSON.stringify(s));
    // Resuming continues deterministically.
    const a = act(s, { type: "endDay", expectedDay: s.day });
    const b = act(r.state!, { type: "endDay", expectedDay: s.day });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it("rejects corrupted, foreign, outdated and tampered saves", () => {
    expect(deserialize("{nope").status).toBe("invalid");
    expect(deserialize(JSON.stringify({ app: "other", state: {} })).status).toBe("invalid");
    const s = newGame();
    expect(deserialize(JSON.stringify({ app: "creator-hustle", state: { ...s, schemaVersion: 0 } })).status).toBe("outdated");
    expect(deserialize(JSON.stringify({ app: "creator-hustle", state: { ...s, audience: -5 } })).status).toBe("invalid");
    expect(deserialize(JSON.stringify({ app: "creator-hustle", state: { ...s, upgrades: ["ringlight", "ringlight"] } })).status).toBe("invalid");
    expect(deserialize(JSON.stringify({ app: "creator-hustle", state: { ...s, path: "hacker" } })).status).toBe("invalid");
    expect(deserialize(JSON.stringify({ app: "creator-hustle", state: { ...s, day: 5 } })).status).toBe("invalid"); // history mismatch
    expect(deserialize(serialize(s)).status).toBe("ok");
  });
  it("handles missing storage gracefully", () => {
    expect(saveGame(newGame(), null)).toBe(false);
    expect(loadGame(null).status).toBe("unavailable");
    const throwing: StorageLike = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
    expect(saveGame(newGame(), throwing)).toBe(false);
    expect(loadGame(throwing).status).toBe("unavailable");
  });
});

describe("local platform adapter", () => {
  it("keeps a local top-10 that is clearly not official", async () => {
    const p = new LocalPlatform(memoryStorage());
    expect(p.official).toBe(false);
    expect(p.label).toMatch(/local/i);
    for (let i = 0; i < 12; i++) await p.submitScore({ name: `P${i}`, score: i * 100, grade: "C", path: "Writer", day: "2026-10-13" });
    const board = await p.leaderboard();
    expect(board).toHaveLength(10);
    expect(board[0]!.score).toBe(1100);
  });
});

describe("forecast", () => {
  it("roughly matches simulated averages", () => {
    const base = act(tweak(launch(newGame("knowledge", 2), "ebook", 2_500), (d) => (d.emailList = 800)), {
      type: "setPlan",
      plan: { posts: 2, email: true },
    });
    const f = forecastDay(base);
    let visitors = 0;
    const N = 40;
    for (let i = 0; i < N; i++) {
      const s = endDays(tweak(base, (d) => (d.seed = 1000 + i)), 1);
      const r = s.history[s.history.length - 1]!;
      visitors += r.visitors.organic + r.visitors.email;
    }
    const avg = visitors / N;
    expect(avg).toBeGreaterThan(f.totalVisitors * 0.6);
    expect(avg).toBeLessThan(f.totalVisitors * 1.6);
  });
});
