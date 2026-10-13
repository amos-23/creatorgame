import type { PathId, ProductType } from "../engine/types";

export interface Topic {
  id: string;
  label: string;
  /** Market demand multiplier for products on this topic. */
  demand: number;
  /** How willing buyers in this topic are to pay premium prices (scales reference price). */
  priceTolerance: number;
}

export const TOPICS: Record<string, Topic> = {
  career: { id: "career", label: "Careers & CVs", demand: 1.0, priceTolerance: 1.0 },
  finance: { id: "finance", label: "Personal finance", demand: 1.1, priceTolerance: 1.15 },
  tech: { id: "tech", label: "Tech skills", demand: 1.15, priceTolerance: 1.25 },
  travel: { id: "travel", label: "Travel & study abroad", demand: 1.05, priceTolerance: 1.2 },
  food: { id: "food", label: "Food & recipes", demand: 1.0, priceTolerance: 0.85 },
  editing: { id: "editing", label: "Video editing", demand: 1.05, priceTolerance: 1.0 },
  fiction: { id: "fiction", label: "Fiction & stories", demand: 0.9, priceTolerance: 0.8 },
  copywriting: { id: "copywriting", label: "Copywriting", demand: 1.05, priceTolerance: 1.1 },
  faith: { id: "faith", label: "Faith & devotionals", demand: 0.95, priceTolerance: 0.85 },
  fitness: { id: "fitness", label: "Fitness & wellness", demand: 1.0, priceTolerance: 1.05 },
  business: { id: "business", label: "Small business growth", demand: 1.1, priceTolerance: 1.2 },
  social: { id: "social", label: "Social media growth", demand: 1.1, priceTolerance: 1.0 },
  techcommunity: { id: "techcommunity", label: "Local tech community", demand: 1.0, priceTolerance: 0.95 },
  creative: { id: "creative", label: "Creative meetups", demand: 0.95, priceTolerance: 0.9 },
};

export interface CreatorPath {
  id: PathId;
  label: string;
  short: string;
  icon: string;
  pitch: string;
  advantage: string;
  challenge: string;
  topics: string[];
  startAudience: number;
  startFit: number;
  startReputation: number;
  startEmail: number;
  /** Product skill: starting quality for each product type (0.3 - 1.0). */
  skill: Record<ProductType, number>;
  /** Product types available from day one regardless of rank. */
  earlyProducts: ProductType[];
  organicReachMult: number;
  organicNoise: number;
  postHours: number;
  optInMult: number;
  devHoursMult: Partial<Record<ProductType, number>>;
  setupCostMult: Partial<Record<ProductType, number>>;
  priceTolerance: Partial<Record<ProductType, number>>;
  churnMult: number;
  eventCapacityBonus: number;
  repeatBuyerMult: number;
  /** Email traffic converts better for creators with loyal readers. */
  emailConvMult: number;
  baseHours: number;
  /** Quality depends more heavily on equipment upgrades (video creators). */
  equipmentSensitivity: number;
  firstObjective: string;
  startTip: string;
}

export const PATHS: Record<PathId, CreatorPath> = {
  knowledge: {
    id: "knowledge",
    label: "Knowledge Creator",
    short: "Knowledge",
    icon: "🧠",
    pitch: "You have professional expertise people pay to learn.",
    advantage: "Strong ebooks and courses; buyers trust your expertise.",
    challenge: "Content takes longer to make and courses are a big build.",
    topics: ["career", "finance", "tech"],
    startAudience: 350,
    startFit: 0.7,
    startReputation: 32,
    startEmail: 20,
    skill: { ebook: 0.72, template: 0.55, course: 0.78, membership: 0.5, event: 0.5, coaching: 0.6 },
    earlyProducts: ["ebook", "template", "coaching", "course"],
    organicReachMult: 0.95,
    organicNoise: 0.3,
    postHours: 3,
    optInMult: 1.1,
    devHoursMult: { course: 0.85 },
    setupCostMult: {},
    priceTolerance: { course: 1.2, ebook: 1.1 },
    churnMult: 1,
    eventCapacityBonus: 0,
    repeatBuyerMult: 1,
    emailConvMult: 1,
    baseHours: 10,
    equipmentSensitivity: 0.6,
    firstObjective: "Package your expertise into an ebook.",
    startTip: "Your audience is small but trusts you. Turn what you know into an ebook, then grow toward a course.",
  },
  video: {
    id: "video",
    label: "Video & Media Creator",
    short: "Video",
    icon: "🎬",
    pitch: "You make videos people watch and share.",
    advantage: "Big organic reach and the most viral moments.",
    challenge: "Reach is unpredictable and quality depends on your gear.",
    topics: ["editing", "food", "travel"],
    startAudience: 1_300,
    startFit: 0.42,
    startReputation: 25,
    startEmail: 0,
    skill: { ebook: 0.45, template: 0.62, course: 0.58, membership: 0.5, event: 0.5, coaching: 0.45 },
    earlyProducts: ["template", "ebook", "course"],
    organicReachMult: 1.1,
    organicNoise: 0.6,
    postHours: 2,
    optInMult: 0.8,
    devHoursMult: {},
    setupCostMult: {},
    priceTolerance: {},
    churnMult: 1,
    eventCapacityBonus: 0,
    repeatBuyerMult: 0.9,
    emailConvMult: 0.9,
    baseHours: 10,
    equipmentSensitivity: 1.4,
    firstObjective: "Sell a template pack (presets, LUTs or scripts) to your viewers.",
    startTip: "You have reach, but much of your audience just watches. Sell something cheap and useful, and invest in gear.",
  },
  writer: {
    id: "writer",
    label: "Writer & Storyteller",
    short: "Writer",
    icon: "✍️",
    pitch: "You write words people want to read.",
    advantage: "Ebooks are quick and cheap to make; readers come back for more.",
    challenge: "Hard to be discovered; readers need repeat releases.",
    topics: ["fiction", "copywriting", "faith"],
    startAudience: 260,
    startFit: 0.78,
    startReputation: 28,
    startEmail: 40,
    skill: { ebook: 0.82, template: 0.6, course: 0.55, membership: 0.55, event: 0.45, coaching: 0.5 },
    earlyProducts: ["ebook", "template", "coaching"],
    organicReachMult: 0.75,
    organicNoise: 0.3,
    postHours: 2,
    optInMult: 1.6,
    devHoursMult: { ebook: 0.55, template: 0.8 },
    setupCostMult: { ebook: 0.3 },
    priceTolerance: {},
    churnMult: 0.9,
    eventCapacityBonus: 0,
    repeatBuyerMult: 2.2,
    emailConvMult: 1.35,
    baseHours: 10,
    equipmentSensitivity: 0.3,
    firstObjective: "Publish your first ebook and build a reader list.",
    startTip: "Your list is your superpower. Use a free sample to grow subscribers, then release more titles.",
  },
  coach: {
    id: "coach",
    label: "Coach & Service Provider",
    short: "Coach",
    icon: "🤝",
    pitch: "You help clients get results, one conversation at a time.",
    advantage: "High-value sessions and strong trust from the start.",
    challenge: "Every session uses your limited hours.",
    topics: ["fitness", "business", "career"],
    startAudience: 220,
    startFit: 0.8,
    startReputation: 38,
    startEmail: 25,
    skill: { ebook: 0.55, template: 0.55, course: 0.6, membership: 0.6, event: 0.55, coaching: 0.85 },
    earlyProducts: ["coaching", "ebook", "template"],
    organicReachMult: 0.85,
    organicNoise: 0.3,
    postHours: 2,
    optInMult: 1,
    devHoursMult: { coaching: 0.5 },
    setupCostMult: {},
    priceTolerance: { coaching: 1.35 },
    churnMult: 0.9,
    eventCapacityBonus: 0,
    repeatBuyerMult: 1,
    emailConvMult: 1.1,
    baseHours: 10,
    equipmentSensitivity: 0.5,
    firstObjective: "Book your first paid coaching session.",
    startTip: "Clients pay well for your time, but time runs out. Use sessions for early cash, then package your method.",
  },
  community: {
    id: "community",
    label: "Community & Events Creator",
    short: "Community",
    icon: "🎉",
    pitch: "You bring people together and keep them coming back.",
    advantage: "Members stay longer and your events hold more people.",
    challenge: "Communities need daily care; events have fixed dates.",
    topics: ["techcommunity", "creative", "social"],
    startAudience: 600,
    startFit: 0.65,
    startReputation: 30,
    startEmail: 60,
    skill: { ebook: 0.5, template: 0.55, course: 0.5, membership: 0.78, event: 0.78, coaching: 0.5 },
    earlyProducts: ["membership", "event", "template"],
    organicReachMult: 1.0,
    organicNoise: 0.35,
    postHours: 2,
    optInMult: 1.2,
    devHoursMult: { event: 0.8, membership: 0.8 },
    setupCostMult: { event: 0.6 },
    priceTolerance: {},
    churnMult: 0.6,
    eventCapacityBonus: 15,
    repeatBuyerMult: 1.2,
    emailConvMult: 1.1,
    baseHours: 10,
    equipmentSensitivity: 0.5,
    firstObjective: "Launch a membership or sell tickets to a meetup.",
    startTip: "Your people already gather. Charge a small weekly fee or run a workshop, and look after members so they stay.",
  },
};

export const PATH_ORDER: PathId[] = ["knowledge", "video", "writer", "coach", "community"];
