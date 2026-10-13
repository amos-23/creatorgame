// Seeded campaign tests: multiple strategies played through the real action
// reducer. These guard the balance goals: several strategies can win, idleness
// doesn't, and no single approach trivially dominates.
import { describe, expect, it } from "vitest";
import { PATH_ORDER } from "../src/config/paths";
import { netProfit, netRevenue } from "../src/engine/economy";
import { STRATEGIES, playCampaign } from "../src/sim/strategies";

const SEEDS = [11, 222, 3333, 44444, 555555, 66, 777, 8888];
const spec = (id: string) => STRATEGIES.find((s) => s.id === id)!;

function winRate(id: string, path = "knowledge" as (typeof PATH_ORDER)[number]) {
  const runs = SEEDS.map((seed) => playCampaign(seed, path, spec(id)));
  return { rate: runs.filter((r) => r.outcome === "win").length / runs.length, runs };
}

describe("seeded campaign strategies", () => {
  it("covers the strategies listed in the brief", () => {
    for (const id of ["organic", "ads", "affiliate", "email", "volume", "premium", "diversify", "conservative", "aggressive"]) expect(spec(id)).toBeTruthy();
  });

  it("every campaign completes with a valid outcome and consistent books", () => {
    for (const s of STRATEGIES) {
      const r = playCampaign(99, "writer", s);
      expect(r.phase).toBe("ended");
      expect(["win", "survived", "insolvent"]).toContain(r.outcome);
      expect(Number.isFinite(r.cash)).toBe(true);
      expect(Math.abs(r.cash - (5_000 + netProfit(r) - r.totals.investments))).toBeLessThanOrEqual(r.history.length + 2);
    }
  });

  it("several different strategies can win", () => {
    const winners = ["organic", "affiliate", "diversify", "volume"].filter((id) => winRate(id).rate >= 0.5);
    expect(winners.length).toBeGreaterThanOrEqual(3);
  });

  it("every creator path has at least one strategy that usually wins", () => {
    for (const p of PATH_ORDER) {
      const best = Math.max(...["organic", "affiliate", "diversify"].map((id) => winRate(id, p).rate));
      expect(best, p).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("doing nothing does not win", () => {
    expect(winRate("idle").rate).toBe(0);
  });

  it("aggressive growth with fulfilment strain earns thin profit margins", () => {
    const agg = winRate("aggressive").runs;
    const div = winRate("diversify").runs;
    const margin = (rs: typeof agg) => rs.reduce((a, r) => a + netProfit(r), 0) / Math.max(1, rs.reduce((a, r) => a + netRevenue(r), 0));
    expect(margin(agg)).toBeLessThan(margin(div));
  });

  it("is not decided by luck alone: the same strategy varies, but within bounds", () => {
    const revs = winRate("organic").runs.map(netRevenue).sort((a, b) => a - b);
    expect(revs[revs.length - 1]!).toBeGreaterThan(revs[0]!); // randomness matters
    expect(revs[revs.length - 1]! / Math.max(1, revs[0]!)).toBeLessThan(6); // but doesn't dominate
  });
});
