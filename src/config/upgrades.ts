import type { ProductType } from "../engine/types";

export type UpgradeCategory = "productivity" | "workspace" | "marketing" | "quality" | "support";

export interface UpgradeEffects {
  hours?: number;
  contentQuality?: number;
  organicReach?: number;
  qualityBonus?: Partial<Record<ProductType, number>>;
  /** Equipment that scales with path equipment sensitivity (video gear). */
  equipment?: number;
  powerBackup?: boolean;
  internetBackup?: boolean;
  refundMult?: number;
  satisfactionTarget?: number;
  optInMult?: number;
  emailFreshnessBonus?: number;
  adFit?: number;
  cpmMult?: number;
  eventCapacity?: number;
  convMult?: number;
  reputationOnce?: number;
  postHoursCut?: number;
  dailyCost?: number;
  payoutProtection?: boolean;
  wellbeingRecovery?: number;
  piracyProtection?: boolean;
}

export interface Upgrade {
  id: string;
  name: string;
  icon: string;
  category: UpgradeCategory;
  cost: number;
  minRank: number;
  description: string;
  effectText: string;
  effects: UpgradeEffects;
  requires?: string;
}

export const UPGRADES: Upgrade[] = [
  {
    id: "ringlight",
    name: "Ring Light & Tripod",
    icon: "💡",
    category: "quality",
    cost: 4_000,
    minRank: 0,
    description: "Steady shots and flattering light for every post.",
    effectText: "+15% content quality, +8% organic reach",
    effects: { contentQuality: 0.15, organicReach: 0.08, equipment: 0.05 },
  },
  {
    id: "planner",
    name: "Content Planning Board",
    icon: "🗂️",
    category: "productivity",
    cost: 3_000,
    minRank: 0,
    description: "Batch ideas on a whiteboard so posting takes less time.",
    effectText: "Posts take 1 hour less; +3 wellbeing recovery a day",
    effects: { postHoursCut: 1, wellbeingRecovery: 3 },
  },
  {
    id: "design",
    name: "Pro Design Suite",
    icon: "🎨",
    category: "quality",
    cost: 7_000,
    minRank: 0,
    description: "Better covers, layouts and templates.",
    effectText: "+0.12 quality for ebooks & templates",
    effects: { qualityBonus: { ebook: 0.12, template: 0.12 } },
  },
  {
    id: "chair",
    name: "Ergonomic Desk & Chair",
    icon: "🪑",
    category: "workspace",
    cost: 12_000,
    minRank: 1,
    description: "Work longer without back pain.",
    effectText: "+2 hours every day",
    effects: { hours: 2 },
  },
  {
    id: "router",
    name: "Backup MiFi Router",
    icon: "📶",
    category: "workspace",
    cost: 8_000,
    minRank: 0,
    description: "A second network for when your main connection drops.",
    effectText: "Internet outages barely affect you",
    effects: { internetBackup: true },
  },
  {
    id: "inverter",
    name: "Inverter & Solar Battery",
    icon: "🔋",
    category: "workspace",
    cost: 30_000,
    minRank: 1,
    description: "Keep working through power cuts, no fuel queues.",
    effectText: "Power cuts no longer cost hours or fuel",
    effects: { powerBackup: true },
  },
  {
    id: "mic",
    name: "Condenser Mic & Acoustic Panels",
    icon: "🎙️",
    category: "quality",
    cost: 18_000,
    minRank: 1,
    description: "Clean audio for videos, lessons and live sessions.",
    effectText: "+10% content quality, +0.1 course/membership quality",
    effects: { contentQuality: 0.1, qualityBonus: { course: 0.1, membership: 0.08 }, equipment: 0.08 },
  },
  {
    id: "camera",
    name: "Mirrorless Camera Kit",
    icon: "📷",
    category: "quality",
    cost: 60_000,
    minRank: 2,
    description: "Cinematic video that stops the scroll.",
    effectText: "+20% content quality, +15% organic reach, better courses",
    effects: { contentQuality: 0.2, organicReach: 0.15, qualityBonus: { course: 0.1 }, equipment: 0.15 },
  },
  {
    id: "emailsuite",
    name: "Email Automation Suite",
    icon: "📧",
    category: "marketing",
    cost: 15_000,
    minRank: 1,
    description: "Welcome sequences and smart segments.",
    effectText: "Double list sign-ups; emails tire readers less",
    effects: { optInMult: 2, emailFreshnessBonus: 0.08 },
  },
  {
    id: "adskills",
    name: "Ad Targeting Masterclass",
    icon: "🎯",
    category: "marketing",
    cost: 20_000,
    minRank: 1,
    description: "Learn audiences, lookalikes and creative testing.",
    effectText: "Ad visitors fit far better; ads cost 12% less",
    effects: { adFit: 0.22, cpmMult: 0.88 },
  },
  {
    id: "helpdesk",
    name: "Customer Support Helpdesk",
    icon: "🎧",
    category: "support",
    cost: 9_000,
    minRank: 1,
    description: "Canned replies, a FAQ and an order tracker.",
    effectText: "-40% refunds, happier customers",
    effects: { refundMult: 0.6, satisfactionTarget: 8 },
  },
  {
    id: "secure",
    name: "Secure Product Hosting",
    icon: "🔒",
    category: "support",
    cost: 6_000,
    minRank: 0,
    description: "View-only, watermarked delivery and multiple payment options.",
    effectText: "Blocks piracy events; payment delays are shorter",
    effects: { piracyProtection: true, payoutProtection: true },
  },
  {
    id: "assistant",
    name: "Virtual Assistant",
    icon: "🧑‍💻",
    category: "productivity",
    cost: 10_000,
    minRank: 2,
    description: "A part-time assistant handles inbox, scheduling and support.",
    effectText: "+4 hours every day (₦1,500 daily salary)",
    effects: { hours: 4, dailyCost: 1_500 },
  },
  {
    id: "venue",
    name: "Event Venue Partnership",
    icon: "🏛️",
    category: "marketing",
    cost: 25_000,
    minRank: 2,
    description: "A partner hall with a better rate and more seats.",
    effectText: "+50 event seats per event",
    effects: { eventCapacity: 50 },
  },
  {
    id: "makeover",
    name: "Studio Makeover",
    icon: "✨",
    category: "workspace",
    cost: 80_000,
    minRank: 3,
    description: "A branded set: neon sign, plants, rug and shelves.",
    effectText: "+10 reputation, +8% conversion on everything",
    effects: { reputationOnce: 10, convMult: 1.08, contentQuality: 0.05 },
  },
];

export const UPGRADE_BY_ID: Record<string, Upgrade> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
