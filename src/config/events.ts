// Random events. Each event is rolled at the end of a day and presented the next
// morning as a decision. Every event offers at least one option that costs no cash,
// so no event can force the player into failure.

import { hasUpgradeFlag, liveProducts, clamp } from "../engine/economy";
import type { Rng } from "../engine/rng";
import type { EventChoice, GameState, Modifier, ProductType } from "../engine/types";
import { PRODUCT_TYPES } from "./products";

export type EventCategory =
  | "infrastructure"
  | "viral"
  | "ads"
  | "affiliate"
  | "refund"
  | "competitor"
  | "feedback"
  | "expense"
  | "seasonal"
  | "opportunity"
  | "wellbeing";

export interface BuiltEvent {
  title: string;
  description: string;
  choices: EventChoice[];
  params: Record<string, number>;
}

export interface GameEventDef {
  id: string;
  category: EventCategory;
  icon: string;
  minDay: number;
  weight: (s: GameState) => number;
  build: (s: GameState, rng: Rng) => BuiltEvent;
  /** Apply the chosen option. Mutates the draft state. Returns a short result line. */
  apply: (s: GameState, choiceId: string, params: Record<string, number>) => string;
}

let modCounter = 0;
export function addModifier(s: GameState, m: Omit<Modifier, "id">): void {
  modCounter++;
  s.modifiers.push({ ...m, id: `${m.kind}-${s.day}-${modCounter}-${s.modifiers.length}` });
}

export function addAudience(s: GameState, count: number, fit: number): void {
  const n = Math.max(0, Math.round(count));
  if (n === 0) return;
  s.audienceFit = clamp((s.audience * s.audienceFit + n * fit) / (s.audience + n), 0.05, 0.98);
  s.audience += n;
}

const TYPE_INDEX: ProductType[] = ["ebook", "template", "course", "membership", "event", "coaching"];
const paidLive = (s: GameState) => liveProducts(s).filter((p) => p.price > 0);
const bestSeller = (s: GameState) => [...paidLive(s)].sort((a, b) => b.sales - a.sales)[0];

export const EVENTS: GameEventDef[] = [
  {
    id: "power-cut",
    category: "infrastructure",
    icon: "🔌",
    minDay: 2,
    weight: (s) => (hasUpgradeFlag(s, "powerBackup") ? 0 : 1.2),
    build: () => ({
      title: "NEPA took light",
      description: "A long power cut is expected today. Your laptop battery won't last the day.",
      params: {},
      choices: [
        { id: "fuel", label: "Buy generator fuel", description: "Keep working as normal.", cost: 2_500 },
        { id: "workaround", label: "Work around it", description: "Lose 4 working hours today.", cost: 0 },
      ],
    }),
    apply: (s, c) => {
      if (c === "workaround") {
        addModifier(s, { kind: "hours", value: -4, daysLeft: 1, label: "Power cut: -4 hours", positive: false });
        return "You charged what you could and lost a few hours.";
      }
      return "The generator hummed all day. Work continued.";
    },
  },
  {
    id: "internet-outage",
    category: "infrastructure",
    icon: "📡",
    minDay: 2,
    weight: (s) => (hasUpgradeFlag(s, "internetBackup") ? 0.15 : 1),
    build: (s) => {
      const backed = hasUpgradeFlag(s, "internetBackup");
      return {
        title: "Network down",
        description: backed
          ? "Your main network dropped, but your backup router kicked in."
          : "Your network provider is down across the area. Posts, ads and checkouts will struggle today.",
        params: { backed: backed ? 1 : 0 },
        choices: backed
          ? [{ id: "ok", label: "Switch to backup", description: "Barely any impact.", cost: 0 }]
          : [
              { id: "data", label: "Buy a second SIM's data", description: "Reach and sales only dip slightly.", cost: 1_500 },
              { id: "wait", label: "Wait it out", description: "Reach -60% and conversions -30% today.", cost: 0 },
            ],
      };
    },
    apply: (s, c) => {
      if (c === "ok") {
        addModifier(s, { kind: "reach", value: 0.95, daysLeft: 1, label: "Network blip", positive: false });
        return "Backup router saved the day.";
      }
      if (c === "data") {
        addModifier(s, { kind: "reach", value: 0.85, daysLeft: 1, label: "Spotty network", positive: false });
        return "Slower, but you stayed online.";
      }
      addModifier(s, { kind: "reach", value: 0.4, daysLeft: 1, label: "Network outage", positive: false });
      addModifier(s, { kind: "conv", value: 0.7, daysLeft: 1, label: "Checkouts failing", positive: false });
      return "A quiet, offline day.";
    },
  },
  {
    id: "payment-delay",
    category: "infrastructure",
    icon: "⏳",
    minDay: 4,
    weight: (s) => (s.totals.sales > 3 ? 0.8 : 0),
    build: (s) => {
      const protectedPay = hasUpgradeFlag(s, "payoutProtection");
      return {
        title: "Payouts delayed",
        description: protectedPay
          ? "Your main payment partner is slow this week. Your backup options soften the blow."
          : "Your payment partner is holding payouts for review. Revenue will take longer to reach your cash.",
        params: { delay: protectedPay ? 1 : 2 },
        choices: [
          { id: "accept", label: "Accept the delay", description: "Payouts arrive later for 4 days.", cost: 0 },
          {
            id: "transfer",
            label: "Offer direct bank transfer",
            description: "Set up an alternative route. Shorter delay, a little admin time.",
            cost: 0,
            hoursCost: 1,
          },
        ],
      };
    },
    apply: (s, c, p) => {
      const delay = c === "transfer" ? Math.max(0, (p.delay ?? 2) - 1) : p.delay ?? 2;
      if (delay > 0)
        addModifier(s, { kind: "payoutDelay", value: delay, daysLeft: 4, label: `Payouts +${delay} day(s)`, positive: false });
      return delay > 0 ? `Payouts will take ${delay} extra day(s) for a while.` : "Bank transfers kept cash flowing.";
    },
  },
  {
    id: "repair",
    category: "expense",
    icon: "🛠️",
    minDay: 3,
    weight: () => 0.8,
    build: (s, rng) => {
      const cost = Math.round((3_000 + rng() * 5_000 + s.rank * 2_000) / 500) * 500;
      return {
        title: "Laptop trouble",
        description: "Your laptop's charging port is failing. It needs attention.",
        params: { cost },
        choices: [
          { id: "repair", label: "Proper repair", description: "Fixed for good.", cost },
          {
            id: "cheap",
            label: "Roadside quick fix",
            description: "Cheaper, but it keeps cutting out: -2 hours for 3 days.",
            cost: Math.round(cost / 3 / 50) * 50,
          },
          { id: "borrow", label: "Borrow a friend's laptop", description: "Free, but -3 hours for 2 days and stress.", cost: 0 },
        ],
      };
    },
    apply: (s, c) => {
      if (c === "cheap") {
        addModifier(s, { kind: "hours", value: -2, daysLeft: 3, label: "Unreliable laptop", positive: false });
        return "It works... mostly.";
      }
      if (c === "borrow") {
        addModifier(s, { kind: "hours", value: -3, daysLeft: 2, label: "Borrowed laptop", positive: false });
        s.wellbeing = clamp(s.wellbeing - 6, 0, 100);
        return "Grateful for friends, frustrated by the setup.";
      }
      return "Good as new.";
    },
  },
  {
    id: "viral",
    category: "viral",
    icon: "🔥",
    minDay: 2,
    weight: (s) => (s.postsMade > 0 ? (s.path === "video" ? 1.4 : 0.8) : 0),
    build: (s, rng) => {
      const mult = s.path === "video" ? 1.6 : 1;
      const followers = Math.round((400 + s.audience * (0.3 + rng() * 0.4)) * mult);
      return {
        title: "One of your posts went viral!",
        description: `A post blew up overnight. About ${followers.toLocaleString()} new people are looking at your page.`,
        params: { followers },
        choices: [
          {
            id: "pin",
            label: "Pin your store link",
            description: "Turn attention into store visits today.",
            cost: 0,
          },
          {
            id: "ride",
            label: "Ride the wave",
            description: "Post follow-ups (3 hours): more followers and reach for 2 days.",
            cost: 0,
            hoursCost: 3,
          },
          { id: "enjoy", label: "Just enjoy it", description: "Keep the new followers.", cost: 0 },
        ],
      };
    },
    apply: (s, c, p) => {
      const f = p.followers ?? 500;
      if (c === "pin") {
        addAudience(s, f * 0.6, 0.35);
        addModifier(s, { kind: "bonusVisitors", value: Math.round(f * 0.12), daysLeft: 1, label: "Viral traffic", positive: true });
        return "Your store link is getting clicks.";
      }
      if (c === "ride") {
        addAudience(s, f * 1.1, 0.35);
        addModifier(s, { kind: "reach", value: 1.8, daysLeft: 2, label: "Viral momentum", positive: true });
        return "The algorithm loves you right now.";
      }
      addAudience(s, f * 0.6, 0.35);
      return "New followers, mixed relevance.";
    },
  },
  {
    id: "ad-spike",
    category: "ads",
    icon: "📈",
    minDay: 4,
    weight: (s) => (s.adDays > 0 ? 1 : 0.3),
    build: () => ({
      title: "Ad prices surge",
      description: "Big brands are flooding the feeds with campaigns. Ad costs will jump for the next 4 days.",
      params: {},
      choices: [
        { id: "pause", label: "Pause ads for now", description: "Sets today's ad budget to ₦0.", cost: 0 },
        { id: "continue", label: "Keep running ads", description: "Pay more per impression.", cost: 0 },
      ],
    }),
    apply: (s, c) => {
      addModifier(s, { kind: "cpm", value: 1.7, daysLeft: 4, label: "Ad prices +70%", positive: false });
      if (c === "pause") s.plan.adBudget = 0;
      return c === "pause" ? "Ads paused while prices are high." : "Ads keep running at a premium.";
    },
  },
  {
    id: "ad-sale",
    category: "ads",
    icon: "📉",
    minDay: 3,
    weight: () => 0.6,
    build: () => ({
      title: "Cheap ad inventory",
      description: "It's a quiet week for advertisers. Ads cost much less for the next 3 days.",
      params: {},
      choices: [{ id: "ok", label: "Noted", description: "Ad prices -40% for 3 days.", cost: 0 }],
    }),
    apply: (s) => {
      addModifier(s, { kind: "cpm", value: 0.6, daysLeft: 3, label: "Ad prices -40%", positive: true });
      return "A good time to test ads.";
    },
  },
  {
    id: "affiliate-offer",
    category: "affiliate",
    icon: "🤝",
    minDay: 4,
    weight: (s) => (paidLive(s).length > 0 && s.reputation >= 25 ? 1 : 0),
    build: () => ({
      title: "A big creator wants to promote you",
      description:
        "A creator with an engaged community offers to promote your products for the next 5 days. They want a 50% commission on sales they bring.",
      params: {},
      choices: [
        { id: "accept", label: "Accept the partnership", description: "+6 affiliates with boosted traffic for 5 days.", cost: 0 },
        { id: "decline", label: "Politely decline", description: "Keep your margins.", cost: 0 },
      ],
    }),
    apply: (s, c) => {
      if (c === "accept") {
        s.affiliates += 6;
        if (!s.plan.affiliateOn) {
          s.plan.affiliateOn = true;
          s.plan.affiliateCommission = Math.max(s.plan.affiliateCommission, 0.5);
        }
        addModifier(s, { kind: "affiliateBoost", value: 2.2, daysLeft: 5, label: "Partner promotion", positive: true });
        return "Your affiliate program just got a big boost.";
      }
      return "You kept full control of your margins.";
    },
  },
  {
    id: "complaint",
    category: "refund",
    icon: "😠",
    minDay: 3,
    weight: (s) => (s.totals.sales >= 3 ? 0.9 + (s.satisfaction < 60 ? 0.8 : 0) : 0),
    build: (s) => {
      const p = bestSeller(s);
      const refund = Math.max(500, Math.round(((p?.price ?? 2_000) * 2) / 50) * 50);
      return {
        title: "Public complaint",
        description: `A customer posted that your ${p ? p.name : "product"} didn't meet their expectations. Others are watching how you respond.`,
        params: { refund },
        choices: [
          {
            id: "refund",
            label: "Refund and apologise",
            description: "Refund them and a few others. Reputation and satisfaction rise.",
            cost: refund,
            costCategory: "refund",
          },
          { id: "explain", label: "Explain politely", description: "No refund. Small hit to reputation.", cost: 0 },
          { id: "ignore", label: "Ignore it", description: "Reputation and satisfaction drop.", cost: 0 },
        ],
      };
    },
    apply: (s, c) => {
      if (c === "refund") {
        s.reputation = clamp(s.reputation + 2, 0, 100);
        s.satisfaction = clamp(s.satisfaction + 6, 0, 100);
        return "Handled with grace. People noticed.";
      }
      if (c === "explain") {
        s.reputation = clamp(s.reputation - 2, 0, 100);
        s.satisfaction = clamp(s.satisfaction - 2, 0, 100);
        return "Some understood. Some didn't.";
      }
      s.reputation = clamp(s.reputation - 6, 0, 100);
      s.satisfaction = clamp(s.satisfaction - 8, 0, 100);
      return "The thread kept growing.";
    },
  },
  {
    id: "competitor",
    category: "competitor",
    icon: "🥊",
    minDay: 5,
    weight: (s) => (paidLive(s).length > 0 ? 0.9 : 0),
    build: (s, rng) => {
      const options = paidLive(s);
      const target = options[Math.floor(rng() * options.length)]!;
      return {
        title: "A cheaper copycat appears",
        description: `Another creator launched a cheaper ${PRODUCT_TYPES[target.type].label.toLowerCase()} that looks a lot like yours.`,
        params: { type: TYPE_INDEX.indexOf(target.type) },
        choices: [
          {
            id: "bonus",
            label: "Add an exclusive bonus",
            description: "3 hours of work. Demand barely dips.",
            cost: 0,
            hoursCost: 3,
          },
          { id: "discount", label: "Cut the price 20%", description: "Match them on price.", cost: 0 },
          { id: "ignore", label: "Stay the course", description: "Demand -25% for 4 days.", cost: 0 },
        ],
      };
    },
    apply: (s, c, p) => {
      const type = TYPE_INDEX[p.type ?? 0]!;
      if (c === "bonus") {
        addModifier(s, { kind: "demand", value: 0.93, daysLeft: 4, productType: type, label: "Competitor (bonus added)", positive: false });
        return "Your bonus makes yours the better deal.";
      }
      if (c === "discount") {
        for (const prod of s.products)
          if (prod.type === type && prod.status === "live" && prod.price > 0)
            prod.price = Math.max(PRODUCT_TYPES[type].minPrice, Math.round((prod.price * 0.8) / 50) * 50);
        return "Prices cut. Margins thinner.";
      }
      addModifier(s, { kind: "demand", value: 0.75, daysLeft: 4, productType: type, label: "Competitor pressure", positive: false });
      return "Some buyers went for the cheaper option.";
    },
  },
  {
    id: "testimonial",
    category: "feedback",
    icon: "🌟",
    minDay: 3,
    weight: (s) => (s.totals.sales >= 2 ? 0.9 + (s.satisfaction > 75 ? 0.6 : 0) : 0),
    build: () => ({
      title: "A glowing review",
      description: "A customer posted a heartfelt thank-you about how your product helped them.",
      params: {},
      choices: [
        { id: "share", label: "Share it as social proof", description: "+15% conversions for 3 days, +2 reputation.", cost: 0 },
        { id: "thank", label: "Thank them personally", description: "+4 reputation, +4 satisfaction.", cost: 0 },
      ],
    }),
    apply: (s, c) => {
      if (c === "share") {
        addModifier(s, { kind: "conv", value: 1.15, daysLeft: 3, label: "Social proof", positive: true });
        s.reputation = clamp(s.reputation + 2, 0, 100);
        return "The review is doing the selling for you.";
      }
      s.reputation = clamp(s.reputation + 4, 0, 100);
      s.satisfaction = clamp(s.satisfaction + 4, 0, 100);
      return "A loyal customer for life.";
    },
  },
  {
    id: "season",
    category: "seasonal",
    icon: "🗓️",
    minDay: 5,
    weight: () => 0.8,
    build: (s, rng) => {
      const seasons = [
        { name: "Salary week", text: "It's salary week. People are ready to spend on themselves." },
        { name: "Back-to-school", text: "Students and parents are looking for guides and tools." },
        { name: "Relocation season", text: "Lots of people are planning moves and new careers." },
        { name: "Festive season", text: "Holiday spending is up across the timeline." },
      ];
      const i = Math.floor(rng() * seasons.length);
      return {
        title: seasons[i]!.name,
        description: `${seasons[i]!.text} Demand is up for 3 days.`,
        params: { i },
        choices: [
          { id: "promo", label: "Run a themed promo", description: "Demand +45% instead of +25%.", cost: Math.max(1_000, Math.min(5_000, Math.round((s.audience * 0.5) / 100) * 100)) },
          { id: "normal", label: "Business as usual", description: "Demand +25%.", cost: 0 },
        ],
      };
    },
    apply: (s, c) => {
      addModifier(s, { kind: "conv", value: c === "promo" ? 1.45 : 1.25, daysLeft: 3, label: "Seasonal demand", positive: true });
      return "Shoppers are out.";
    },
  },
  {
    id: "brand-deal",
    category: "opportunity",
    icon: "💼",
    minDay: 3,
    weight: (s) => (s.audience >= 400 ? (s.path === "video" ? 1.3 : 0.8) : 0),
    build: (s) => {
      const fee = Math.round((2_000 + s.audience * 4 * (0.6 + s.reputation / 100)) / 500) * 500;
      return {
        title: "Brand deal offer",
        description: `A brand wants one sponsored post for ₦${fee.toLocaleString()}. It's not quite your niche.`,
        params: { fee },
        choices: [
          { id: "accept", label: "Take the deal", description: "3 hours. Paid in 2 days. Slightly dilutes your audience fit.", cost: 0, hoursCost: 3 },
          { id: "decline", label: "Decline, stay on-niche", description: "Your audience appreciates the focus.", cost: 0 },
        ],
      };
    },
    apply: (s, c, p) => {
      if (c === "accept") {
        s.pendingPayouts.push({ day: s.day + 2, amount: p.fee ?? 0 });
        s.dayLedger.otherIncome += p.fee ?? 0;
        s.audienceFit = clamp(s.audienceFit - 0.03, 0.05, 0.98);
        return "Sponsored post scheduled. Payment in 2 days.";
      }
      s.audienceFit = clamp(s.audienceFit + 0.01, 0.05, 0.98);
      return "Focus kept.";
    },
  },
  {
    id: "piracy",
    category: "competitor",
    icon: "🏴‍☠️",
    minDay: 5,
    weight: (s) =>
      hasUpgradeFlag(s, "piracyProtection") ? 0 : paidLive(s).some((p) => p.type === "ebook" || p.type === "template") ? 0.7 : 0,
    build: (s) => {
      const target = paidLive(s).find((p) => p.type === "ebook" || p.type === "template")!;
      return {
        title: "Your product is being pirated",
        description: `Copies of your ${target.name} are circulating free in group chats.`,
        params: { type: TYPE_INDEX.indexOf(target.type) },
        choices: [
          { id: "secure", label: "Buy Secure Product Hosting", description: "View-only, watermarked delivery. Stops it.", cost: 6_000, costCategory: "investment" },
          { id: "takedown", label: "Send takedown requests", description: "2 hours. Demand -10% for 3 days.", cost: 0, hoursCost: 2 },
          { id: "ignore", label: "Ignore it", description: "Demand -25% for 5 days.", cost: 0 },
        ],
      };
    },
    apply: (s, c, p) => {
      const type = TYPE_INDEX[p.type ?? 0]!;
      if (c === "secure") {
        if (!s.upgrades.includes("secure")) s.upgrades.push("secure");
        return "Your products are now protected.";
      }
      if (c === "takedown") {
        addModifier(s, { kind: "demand", value: 0.9, daysLeft: 3, productType: type, label: "Piracy (contained)", positive: false });
        return "Most copies came down.";
      }
      addModifier(s, { kind: "demand", value: 0.75, daysLeft: 5, productType: type, label: "Piracy", positive: false });
      return "Free copies keep spreading.";
    },
  },
  {
    id: "flagged",
    category: "infrastructure",
    icon: "🚫",
    minDay: 6,
    weight: (s) => (s.postsMade >= 5 ? 0.6 : 0),
    build: (s) => ({
      title: "Account flagged as spam",
      description: "The platform flagged your sales posts. Your reach is restricted for 2 days.",
      params: { list: s.emailList },
      choices: [
        { id: "appeal", label: "Appeal and rephrase posts", description: "2 hours. Restriction mostly lifted.", cost: 0, hoursCost: 2 },
        { id: "email", label: "Lean on your email list", description: "Email clicks +40% while restricted.", cost: 0 },
      ],
    }),
    apply: (s, c) => {
      if (c === "appeal") {
        addModifier(s, { kind: "reach", value: 0.8, daysLeft: 1, label: "Restricted (appealed)", positive: false });
        return "Appeal accepted.";
      }
      addModifier(s, { kind: "reach", value: 0.5, daysLeft: 2, label: "Account restricted", positive: false });
      addModifier(s, { kind: "emailBoost", value: 1.4, daysLeft: 2, label: "Email focus", positive: true });
      return "Your list has your back.";
    },
  },
  {
    id: "collab",
    category: "opportunity",
    icon: "🎤",
    minDay: 4,
    weight: (s) => (s.reputation >= 30 ? 0.7 : 0),
    build: (s) => {
      const followers = Math.round(150 + s.audience * 0.2 + s.reputation * 6);
      return {
        title: "Collab invitation",
        description: "A respected creator in your niche invites you to co-host a live session.",
        params: { followers },
        choices: [
          { id: "join", label: "Co-host the live", description: `2 hours. About ${followers.toLocaleString()} highly relevant followers.`, cost: 0, hoursCost: 2 },
          { id: "skip", label: "Not this time", description: "Keep your day free.", cost: 0 },
        ],
      };
    },
    apply: (s, c, p) => {
      if (c === "join") {
        addAudience(s, p.followers ?? 200, 0.85);
        s.reputation = clamp(s.reputation + 2, 0, 100);
        return "Great conversation, great new followers.";
      }
      return "Maybe next time.";
    },
  },
  {
    id: "exhausted",
    category: "wellbeing",
    icon: "😮‍💨",
    minDay: 3,
    weight: (s) => (s.wellbeing < 45 ? 2.5 : 0),
    build: () => ({
      title: "Running on empty",
      description: "You've been pushing hard. Your energy is low and your work is slipping.",
      params: {},
      choices: [
        { id: "rest", label: "Take today off", description: "Rest day: big wellbeing boost.", cost: 0 },
        { id: "push", label: "Push through", description: "-5 wellbeing.", cost: 0 },
      ],
    }),
    apply: (s, c) => {
      if (c === "rest") {
        s.plan.rest = true;
        return "You'll rest today.";
      }
      s.wellbeing = clamp(s.wellbeing - 5, 0, 100);
      return "Coffee and determination.";
    },
  },
];

export const EVENT_BY_ID: Record<string, GameEventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
