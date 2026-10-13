import type { GameState } from "../engine/types";

export interface ObjectiveReward {
  cash?: number;
  reputation?: number;
  story?: string;
}

export interface Objective {
  id: string;
  title: string;
  description: string;
  check: (s: GameState) => boolean;
  reward: ObjectiveReward;
  rewardText: string;
}

const liveProducts = (s: GameState) => s.products.filter((p) => p.status !== "developing");

export const OBJECTIVES: Objective[] = [
  {
    id: "first-product",
    title: "Make something to sell",
    description: "Create your first product on the laptop.",
    check: (s) => s.products.length > 0,
    reward: { reputation: 2 },
    rewardText: "+2 reputation",
  },
  {
    id: "first-post",
    title: "Show up online",
    description: "Publish 3 organic posts.",
    check: (s) => s.postsMade >= 3,
    reward: { story: "start-with-what-you-have" },
    rewardText: "Story: The Borrowed Phone",
  },
  {
    id: "first-sale",
    title: "Your first customer",
    description: "Make your first sale.",
    check: (s) => s.totals.sales > 0,
    reward: { cash: 1_000, story: "expertise-to-product" },
    rewardText: "₦1,000 bonus + story",
  },
  {
    id: "email-50",
    title: "Own your audience",
    description: "Grow your email list to 100 subscribers.",
    check: (s) => s.emailList >= 100,
    reward: { story: "direct-audience" },
    rewardText: "Story: The List That Survived",
  },
  {
    id: "try-ads",
    title: "Test paid ads",
    description: "Run ads on at least 2 days.",
    check: (s) => s.adDays >= 2,
    reward: { story: "ads-with-roi" },
    rewardText: "Story: Spend One, Earn Three",
  },
  {
    id: "affiliates-5",
    title: "Recruit promoters",
    description: "Have 5 active affiliates.",
    check: (s) => s.affiliates >= 5,
    reward: { reputation: 3, story: "affiliates" },
    rewardText: "+3 reputation + story",
  },
  {
    id: "diversify",
    title: "Diversify your offers",
    description: "Have 2 different product types live on your niche topic.",
    check: (s) => new Set(liveProducts(s).filter((p) => p.topic === s.niche).map((p) => p.type)).size >= 2,
    reward: { cash: 3_000 },
    rewardText: "₦3,000 bonus",
  },
  {
    id: "reserve",
    title: "Build a cash cushion",
    description: "End a day with ₦50,000 or more in cash.",
    check: (s) => s.cash >= 50_000,
    reward: { story: "power-and-data" },
    rewardText: "Story: Generator Economics",
  },
  {
    id: "happy-customers",
    title: "Customers love you",
    description: "Reach 75 satisfaction with at least 30 sales.",
    check: (s) => s.satisfaction >= 75 && s.totals.sales >= 30,
    reward: { reputation: 5, story: "bad-batch" },
    rewardText: "+5 reputation + story",
  },
  {
    id: "recurring",
    title: "Gather your people",
    description: "Have 15 active members or host an event.",
    check: (s) =>
      s.products.some((p) => p.type === "membership" && p.members.reduce((a, m) => a + m.count, 0) >= 15) ||
      s.products.some((p) => p.type === "event" && p.status === "completed"),
    reward: { reputation: 4, story: "community-to-event" },
    rewardText: "+4 reputation + story",
  },
  {
    id: "growing",
    title: "Become a Growing Creator",
    description: "Reach ₦250,000 in net revenue.",
    check: (s) => s.rank >= 2,
    reward: { cash: 10_000, story: "small-relevant-audience" },
    rewardText: "₦10,000 bonus + story",
  },
  {
    id: "profitable-week",
    title: "Profitable week",
    description: "Make a net profit on 7 days in a row.",
    check: (s) => {
      const h = s.history;
      if (h.length < 7) return false;
      return h.slice(-7).every((d) => d.netProfit > 0);
    },
    reward: { cash: 5_000 },
    rewardText: "₦5,000 bonus",
  },
];

export const OBJECTIVE_BY_ID: Record<string, Objective> = Object.fromEntries(OBJECTIVES.map((o) => [o.id, o]));

/** How many incomplete objectives are shown at once. */
export const ACTIVE_OBJECTIVES = 3;
