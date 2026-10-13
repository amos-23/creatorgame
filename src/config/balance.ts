// Central balance configuration. Every tunable number used by the simulation
// lives here (or in the per-system config files next to it) so balancing does not
// require touching engine code. Values are game values, not real-world benchmarks.

export const BALANCE = {
  startingCash: 5_000,
  campaignDays: 30,

  // Daily operating costs
  dailyDataCost: 250, // mobile data / internet bundle
  postDataCost: 100, // extra data per organic post
  emailToolFreeLimit: 500, // subscribers before the email tool starts charging
  emailToolCostPer1000: 400, // naira per 1,000 subscribers per send day above the free limit
  paymentFeeRate: 0.05, // checkout / payment processing fee (game value)
  payoutDelayDays: 1, // revenue settles into cash the next day

  // Time and energy
  baseHours: 10,
  hustleHours: 4,
  hustleWellbeingCost: 14,
  restWellbeingGain: 35,
  normalWellbeingRecovery: 6,
  overworkThreshold: 0.95, // fraction of hours used that starts to tire you
  overworkWellbeingCost: 4,
  lowWellbeing: 35, // below this, productivity and quality suffer
  lowWellbeingPenalty: 0.8,
  emailHours: 1,
  supportHoursPerProduct: 0.3,
  supportHoursPerSale: 0.04,

  // Side gig (always-available recovery option)
  sideGigHours: 5,
  sideGigPay: 3_500,
  sideGigPayPerRank: 1_500,

  // Organic content
  postHours: 2,
  organicBaseReach: 220,
  organicReachPerFollower: 0.22,
  organicNoise: 0.35,
  organicClickRate: 0.05,
  organicFollowRate: 0.03,
  baseContentQuality: 0.6,
  fitGainPerPost: 0.006,
  maxFit: 0.95,
  audienceDecayNoPost: 0.004,

  // Paid ads
  baseCpm: 800, // naira per 1,000 impressions
  adCtr: 0.02,
  adFit: 0.4,
  adFollowRate: 0.15, // share of ad visitors who follow
  adSaturationBudget: 40_000, // diminishing returns scale
  adFatiguePerDay: 0.06,
  adFatigueRecovery: 0.04,
  maxAdBudgetRatio: 1, // can't spend more than current cash

  // Email
  emailOpenRate: 0.42,
  emailClickRate: 0.17,
  emailFit: 0.9,
  emailFreshnessCostPerSend: 0.22,
  emailFreshnessRecovery: 0.08,
  optInRate: 0.08, // store visitors who join the list

  // Affiliates
  affiliateRecruitBase: 0.7, // per day at 30% commission and 50 reputation
  affiliateMaxPerReputation: 0.8,
  affiliateVisitors: 5, // visitors per affiliate per day at 30% commission
  affiliateFit: 0.6,
  affiliateChurn: 0.05,
  affiliateSocialProofSales: 5,

  // Channel conversion multipliers (trust of the traffic)
  channelConv: { organic: 1.0, ads: 0.55, email: 1.6, affiliate: 1.1, bonus: 0.9 } as Record<string, number>,

  // Product exposure in the store
  featuredExposure: 1.0,
  otherExposure: 0.35,
  offNicheFitPenalty: 0.6,
  provenTopicSales: 10,
  provenTopicCostCut: 0.3,
  provenTopicDemandBoost: 1.15,

  // Lead magnets (free products)
  freeDownloadConv: 0.35,

  // Repeat buyers
  repeatBuyerRate: 0.06, // share of past customers who consider a new product on launch day

  // Reputation and satisfaction
  startingSatisfaction: 70,
  satisfactionEase: 0.25,
  reputationPerQualitySale: 0.03,
  reputationRefundPenalty: 0.6,
  reputationMax: 100,

  // Quality
  effortHoursMultiplier: { standard: 1, premium: 1.5 },
  effortQualityBonus: { standard: 0, premium: 0.18 },
  improveHours: 4,
  improveCost: 1_000,
  improveQuality: 0.1,
  maxImprovements: 3,
  qualityNoise: 0.05,

  // Events and insolvency
  eventChance: 0.4,
  minEventDay: 3,
  insolvencyDays: 3,

  // Victory conditions (configurable)
  winMinRank: 2, // Growing Creator (0-based index)
  winMinSatisfaction: 55,
  winRequiresProfit: true,
} as const;

export type Balance = typeof BALANCE;
