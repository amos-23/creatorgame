import type { ProductType } from "../engine/types";

export interface ProductTypeConfig {
  type: ProductType;
  label: string;
  plural: string;
  icon: string;
  description: string;
  priceUnit: string;
  minPrice: number;
  maxPrice: number;
  refPrice: number;
  allowFree: boolean;
  baseConversion: number;
  elasticity: number;
  devHours: number;
  setupCost: number;
  refundRate: number;
  unlockRank: number; // 0-based rank needed unless the path unlocks it early
  /** Upgrades that improve quality for this product type, with bonus amounts. */
  fulfilment: string;
  tradeoff: string;
}

export const PRODUCT_TYPES: Record<ProductType, ProductTypeConfig> = {
  ebook: {
    type: "ebook",
    label: "Ebook",
    plural: "Ebooks",
    icon: "📘",
    description: "A focused guide that packages what you know. Cheap to make, sells on volume.",
    priceUnit: "",
    minPrice: 500,
    maxPrice: 15_000,
    refPrice: 2_500,
    allowFree: true,
    baseConversion: 0.08,
    elasticity: 1.3,
    devHours: 12,
    setupCost: 1_500,
    refundRate: 0.03,
    unlockRank: 0,
    fulfilment: "Instant digital delivery. Small support load.",
    tradeoff: "Low price means you need lots of buyers. Easy to copy.",
  },
  template: {
    type: "template",
    label: "Template pack",
    plural: "Templates",
    icon: "🧩",
    description: "Planners, presets, scripts or design kits buyers can use immediately.",
    priceUnit: "",
    minPrice: 500,
    maxPrice: 20_000,
    refPrice: 3_000,
    allowFree: true,
    baseConversion: 0.085,
    elasticity: 1.2,
    devHours: 8,
    setupCost: 1_000,
    refundRate: 0.02,
    unlockRank: 0,
    fulfilment: "Instant delivery. Lowest refunds.",
    tradeoff: "Buyers expect low prices; works best as an add-on.",
  },
  course: {
    type: "course",
    label: "Online course",
    plural: "Courses",
    icon: "🎓",
    description: "Recorded lessons that turn expertise into a premium product.",
    priceUnit: "",
    minPrice: 3_000,
    maxPrice: 150_000,
    refPrice: 15_000,
    allowFree: false,
    baseConversion: 0.028,
    elasticity: 1.0,
    devHours: 30,
    setupCost: 8_000,
    refundRate: 0.05,
    unlockRank: 1,
    fulfilment: "Ongoing student questions. Quality drives refunds.",
    tradeoff: "Big production effort; needs trust before people pay.",
  },
  membership: {
    type: "membership",
    label: "Membership",
    plural: "Memberships",
    icon: "👥",
    description: "A paid community with weekly renewals. Recurring income if members stay.",
    priceUnit: "/week",
    minPrice: 500,
    maxPrice: 10_000,
    refPrice: 1_500,
    allowFree: false,
    baseConversion: 0.03,
    elasticity: 1.1,
    devHours: 10,
    setupCost: 3_000,
    refundRate: 0.0,
    unlockRank: 2,
    fulfilment: "Daily community upkeep that grows with members.",
    tradeoff: "Members churn every week if quality or care slips.",
  },
  event: {
    type: "event",
    label: "Event tickets",
    plural: "Events",
    icon: "🎟️",
    description: "A workshop or meetup with limited seats and a fixed date.",
    priceUnit: "/ticket",
    minPrice: 1_000,
    maxPrice: 50_000,
    refPrice: 5_000,
    allowFree: false,
    baseConversion: 0.04,
    elasticity: 1.2,
    devHours: 10,
    setupCost: 6_000,
    refundRate: 0.03,
    unlockRank: 2,
    fulfilment: "Sells for 6 days, then you host it (6 hours). Venue cost per attendee.",
    tradeoff: "Capacity caps revenue. Empty seats hurt reputation.",
  },
  coaching: {
    type: "coaching",
    label: "Coaching sessions",
    plural: "Coaching",
    icon: "🤝",
    description: "One-to-one sessions. High value per sale, but every sale costs your time.",
    priceUnit: "/session",
    minPrice: 2_000,
    maxPrice: 200_000,
    refPrice: 20_000,
    allowFree: false,
    baseConversion: 0.024,
    elasticity: 0.8,
    devHours: 3,
    setupCost: 500,
    refundRate: 0.04,
    unlockRank: 0,
    fulfilment: "Each session takes 2 hours. Offer slots in your daily plan.",
    tradeoff: "Limited by your hours. Great early cash, hard to scale.",
  },
};

export const PRODUCT_ORDER: ProductType[] = ["ebook", "template", "course", "membership", "event", "coaching"];

export const COACHING_HOURS_PER_SESSION = 2;
export const EVENT_SALES_DAYS = 6;
export const EVENT_HOST_HOURS = 6;
export const EVENT_COST_PER_ATTENDEE = 1_200;
export const EVENT_BASE_CAPACITY = 30;
export const MEMBERSHIP_CYCLE_DAYS = 7;
export const MEMBERSHIP_BASE_CHURN = 0.12;
export const MEMBERSHIP_UPKEEP_BASE = 0.5;
export const MEMBERSHIP_MEMBERS_PER_HOUR = 40;
export const COURSE_HOSTING_DAILY = 150;

export const PRODUCT_NAME_IDEAS: Record<ProductType, string[]> = {
  ebook: ["Starter Guide", "Playbook", "Handbook", "Field Notes", "Cheat Sheet"],
  template: ["Toolkit", "Template Pack", "Planner", "Swipe File", "Preset Pack"],
  course: ["Masterclass", "Bootcamp", "Academy", "Crash Course", "Mastery Course"],
  membership: ["Circle", "Inner Room", "Club", "Hub", "Community"],
  event: ["Live Workshop", "Meetup", "Summit", "Clinic", "Masterclass Live"],
  coaching: ["1:1 Strategy Call", "Clarity Session", "Coaching Call", "Audit Session", "Power Hour"],
};
