// Core data types shared by the simulation, persistence and UI layers.
// The engine is pure TypeScript with no DOM or rendering dependencies.

export type PathId = "knowledge" | "video" | "writer" | "coach" | "community";

export type ProductType =
  | "ebook"
  | "template"
  | "course"
  | "membership"
  | "event"
  | "coaching";

export type Channel = "organic" | "ads" | "email" | "affiliate" | "bonus";

export type Effort = "standard" | "premium";

export type ProductStatus = "developing" | "live" | "completed" | "retired";

export interface Product {
  id: string;
  type: ProductType;
  name: string;
  topic: string;
  price: number;
  quality: number;
  status: ProductStatus;
  devHoursTotal: number;
  devHoursDone: number;
  createdDay: number;
  launchedDay: number | null;
  sales: number;
  revenue: number;
  refunds: number;
  refundedAmount: number;
  /** Ad creative fatigue for this product: 0 = fresh. */
  adFatigue: number;
  /** Membership: active members and when they joined (day) for renewal cycles. */
  members: { day: number; count: number }[];
  /** Event tickets. */
  capacity: number;
  ticketsSold: number;
  eventDay: number | null;
  improvements: number;
  /** Whether this product benefited from a proven topic at creation. */
  provenTopic: boolean;
}

export interface MarketingPlan {
  posts: number; // organic posts today (0-3)
  adBudget: number; // naira spent on ads today
  email: boolean; // send an email campaign today
  affiliateOn: boolean;
  affiliateCommission: number; // 0.2 - 0.6
  featuredProductId: string | null;
  coachingSlots: number; // sessions offered today (each takes hours)
  hustle: boolean; // work extra hours at a wellbeing cost
  rest: boolean; // take the day off
  sideGig: boolean; // freelance gig for quick cash
}

export type ModifierKind =
  | "reach" // multiplies organic reach
  | "cpm" // multiplies ad cost per 1000 impressions
  | "demand" // multiplies conversion (optionally by product type)
  | "hours" // flat change to hours available
  | "payoutDelay" // extra days before payouts settle
  | "refund" // multiplies refund rate
  | "affiliateBoost" // multiplies affiliate visitors
  | "emailBoost" // multiplies email click-through
  | "conv" // multiplies all conversion
  | "bonusVisitors"; // flat extra store visitors (value = visitors per day)

export interface Modifier {
  id: string;
  label: string;
  kind: ModifierKind;
  value: number;
  daysLeft: number;
  productType?: ProductType;
  positive: boolean;
}

export interface PendingPayout {
  day: number; // day on which it settles into cash (start of that day's resolution)
  amount: number;
}

export interface ScheduledRefund {
  day: number;
  productId: string;
  amount: number;
}

export interface ChannelStats {
  visitors: number;
  sales: number;
  revenue: number;
}

export interface DayReport {
  day: number;
  hoursAvailable: number;
  hoursUsed: number;
  visitors: Record<Channel, number>;
  salesByProduct: Record<string, number>;
  revenueByProduct: Record<string, number>;
  channelStats: Record<Channel, ChannelStats>;
  grossRevenue: number;
  refunds: number;
  paymentFees: number;
  affiliateCommissions: number;
  directCosts: number; // event venue, etc.
  operatingCosts: number; // ads, data, tools, salaries
  adSpend: number;
  otherIncome: number; // side gigs, brand deals
  investments: number; // upgrades bought this day
  netProfit: number;
  payoutsReleased: number;
  cashStart: number;
  cashEnd: number;
  audienceStart: number;
  audienceEnd: number;
  newFollowers: number;
  emailListEnd: number;
  newSubscribers: number;
  affiliates: number;
  reputation: number;
  satisfaction: number;
  wellbeing: number;
  missedCoachingDemand: number;
  notes: string[];
  devCompleted: string[];
  eventsHosted: string[];
}

export interface EventChoice {
  id: string;
  label: string;
  description: string;
  cost: number; // naira cost paid immediately
  hoursCost?: number;
  costCategory?: "operating" | "refund" | "investment";
}

/** Money moved during the planning phase of the current day (reset each day). */
export interface DayLedger {
  cashStart: number;
  operating: number;
  investments: number;
  refunds: number;
  otherIncome: number;
  notes: string[];
}

export interface PendingEvent {
  eventId: string;
  day: number;
  title: string;
  description: string;
  choices: EventChoice[];
  /** Values captured when the event was rolled (for scaling offers). */
  params: Record<string, number>;
}

export interface Totals {
  grossRevenue: number;
  refunds: number;
  paymentFees: number;
  affiliateCommissions: number;
  directCosts: number;
  operatingCosts: number;
  adSpend: number;
  otherIncome: number;
  investments: number;
  sales: number;
  customers: number;
}

export interface ObjectiveProgress {
  id: string;
  done: boolean;
  doneDay: number | null;
}

export interface Avatar {
  skin: number; // index into palette
  outfit: number;
  hair: number;
}

export type Outcome = "win" | "survived" | "insolvent" | null;

export interface GameState {
  schemaVersion: number;
  seed: number;
  creatorName: string;
  avatar: Avatar;
  path: PathId;
  niche: string;
  day: number; // current day being planned (1..campaignDays)
  campaignDays: number;
  phase: "planning" | "ended";
  cash: number;
  audience: number;
  audienceFit: number; // 0..1 relevance of audience to niche
  emailList: number;
  emailFreshness: number; // 0..1, decays with each send
  affiliates: number;
  reputation: number; // 0..100
  satisfaction: number; // 0..100
  wellbeing: number; // 0..100
  products: Product[];
  nextProductNumber: number;
  plan: MarketingPlan;
  upgrades: string[];
  modifiers: Modifier[];
  pendingPayouts: PendingPayout[];
  scheduledRefunds: ScheduledRefund[];
  pendingEvent: PendingEvent | null;
  eventHistory: { day: number; eventId: string; choiceId: string }[];
  lastEventDay: number;
  history: DayReport[];
  totals: Totals;
  rank: number; // 0-based index into ranks
  milestones: string[]; // achieved milestone ids
  objectives: ObjectiveProgress[];
  storiesUnlocked: string[];
  postsMade: number;
  emailsSent: number;
  adDays: number;
  sideGigs: number;
  negativeCashDays: number;
  outcome: Outcome;
  tutorialDone: boolean;
  /** Notifications produced by the engine for the UI to display (cleared by UI). */
  inbox: InboxItem[];
  /** Hours already committed today by one-off actions (improve product, brand deal). */
  hoursCommitted: number;
  /** Day-scoped flags to prevent duplicate one-off actions. */
  dayFlags: string[];
  dayLedger: DayLedger;
}

export interface InboxItem {
  kind: "rank" | "milestone" | "objective" | "story" | "info" | "warning";
  id: string;
  title: string;
  body: string;
}

export type Action =
  | { type: "createProduct"; productType: ProductType; topic: string; price: number; effort: Effort; name?: string }
  | { type: "setPrice"; productId: string; price: number }
  | { type: "retireProduct"; productId: string }
  | { type: "improveProduct"; productId: string }
  | { type: "setPlan"; plan: Partial<MarketingPlan> }
  | { type: "buyUpgrade"; upgradeId: string }
  | { type: "resolveEvent"; choiceId: string }
  | { type: "endDay"; expectedDay: number }
  | { type: "completeTutorial" }
  | { type: "clearInbox" };

export interface ActionResult {
  state: GameState;
  ok: boolean;
  error?: string;
}
