// Balance report: plays every scripted strategy on every creator path across many
// seeds and prints outcome statistics. Run with `npm run balance`.

import { PATH_ORDER } from "../src/config/paths";
import { RANKS } from "../src/config/ranks";
import { netProfit, netRevenue } from "../src/engine/economy";
import { computeScore } from "../src/engine/scoring";
import { STRATEGIES, playCampaign } from "../src/sim/strategies";

const SEEDS = Number(process.env.SEEDS ?? 20);
const only = process.env.STRATEGY;
const onlyPath = process.env.PATH_ID;

const fmt = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1000)}k`);
const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)]!;
};

console.log(`Seeds per cell: ${SEEDS}\n`);
const rows: string[][] = [["path", "strategy", "win%", "insolv%", "medRev", "medProfit", "p90Rev", "medRank", "medScore", "medAud"]];
for (const pathId of PATH_ORDER) {
  if (onlyPath && pathId !== onlyPath) continue;
  for (const spec of STRATEGIES) {
    if (only && spec.id !== only) continue;
    const results = [];
    for (let i = 0; i < SEEDS; i++) results.push(playCampaign(1000 + i * 7919, pathId, spec));
    const rev = results.map(netRevenue);
    const prof = results.map(netProfit);
    const wins = results.filter((r) => r.outcome === "win").length;
    const ins = results.filter((r) => r.outcome === "insolvent").length;
    const sortedRev = [...rev].sort((a, b) => a - b);
    rows.push([
      pathId,
      spec.id,
      `${Math.round((wins / SEEDS) * 100)}`,
      `${Math.round((ins / SEEDS) * 100)}`,
      fmt(median(rev)),
      fmt(median(prof)),
      fmt(sortedRev[Math.floor(SEEDS * 0.9)] ?? 0),
      RANKS[median(results.map((r) => r.rank))]!.name,
      `${median(results.map((r) => computeScore(r).total))}`,
      `${median(results.map((r) => r.audience))}`,
    ]);
  }
}
const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => r[i]!.length)));
for (const r of rows) console.log(r.map((c, i) => c.padEnd(widths[i]! + 1)).join(" "));
