# Design mapping: research findings → game mechanics

This document links each research pattern (see [`creator-economy-research.md`](creator-economy-research.md)) to the mechanics that implement it, with the code location and the configuration values that tune it. In-game Creator Story cards are **original, fictional composites**. They use invented characters and no real names, likenesses or income figures. The "Inspired by" column records which documented patterns informed each card, for attribution in the project documentation only.

## Pattern → mechanic

| Pattern | Mechanic in Creator Hustle | Where |
|---|---|---|
| **P1 Start small** | Start with ₦5,000, a bare studio (plastic chair, phone tripod, floor cushion). Cheap ebooks and templates are always available. Upgrades come later and visibly change the studio. | `config/balance.ts` (startingCash), `config/products.ts`, `render/studio.ts` |
| **P2 Expertise → products** | Creator paths give skill (starting quality) in specific product types. Products on your **niche topic** convert at full audience fit; off-niche products get a fit penalty. | `config/paths.ts` (skill, topics), `engine/simulate.ts` (`offNicheFitPenalty`) |
| **P3 Relevance beats reach** | **Audience fit** (0–100%) is tracked separately from audience size. Organic posts and email raise fit; broad ads and viral spikes add low-fit followers. Conversion scales with fit, so a small relevant audience can out-earn a large random one (unit-tested). | `engine/simulate.ts` (`conversionProbability`), `config/events.ts` (`addAudience`), `tests/engine.test.ts` |
| **P4 Affiliates** | Affiliate programme with commission 10–60%. Recruitment grows with commission, reputation and social proof (products with 5+ sales). Commission is deducted from every affiliate sale. "Big creator wants to promote you" event. | `engine/simulate.ts`, `config/balance.ts` (affiliate*), `config/events.ts` (affiliate-offer) |
| **P5 Pricing** | Every product has a reference (market) price that depends on path and topic. Demand responds to price with an elasticity that **steepens the further you overprice**, so extreme prices collapse revenue and very cheap prices sell more units at thin margins. The price hint text in the product wizard mirrors this. | `engine/simulate.ts` (`priceResponse`), `ui/views.ts` (price hint) |
| **P6 Diversify** | Six product types: ebook, template, course, membership (weekly renewals), event tickets (capacity and date) and coaching (service). Once a product on a topic has 10+ sales, the topic is **proven**: related products are 30% cheaper and faster to build and get +15% demand. Store exposure means a featured product gets full attention and others get about a third. | `engine/economy.ts` (`isProvenTopic`), `config/balance.ts` (proven*), objective "Diversify your offers" |
| **P7 Paid ads** | Ads buy visitors at a cost per 1,000 impressions, with lower-fit traffic and a 0.55× trust multiplier, diminishing returns as budget grows, and creative fatigue that recovers when you pause or improve the product. The daily report shows the ad return multiple. | `engine/simulate.ts`, `config/balance.ts` (baseCpm, adCtr, adSaturationBudget, adFatigue*) |
| **P8 Recovery** | **Improve** action (+quality, fresh ad creative). Price changes, the side gig as an always-available cash lifeline, and events that always offer a zero-cost option. Insolvency only after 3 consecutive negative-cash days. | `engine/actions.ts`, `config/events.ts`, `config/balance.ts` (insolvencyDays) |
| **P9 Platform risk** | "Account flagged as spam" event restricts reach; the counterplay is appealing, or leaning on your email list (+email clicks). The objective "Own your audience" encourages building a list early. | `config/events.ts` (flagged), `config/objectives.ts` |
| **P10 Customer care** | Satisfaction (0–100) moves toward a target based on product quality, support capacity, missed coaching demand and refunds. The "Public complaint" event rewards generous refunds with reputation and satisfaction. The Helpdesk upgrade cuts refunds by 40%. Winning requires satisfaction of 55+. | `engine/simulate.ts`, `config/events.ts` (complaint), `config/upgrades.ts` |
| **P11 Capacity and burnout** | Daily hours budget: posts, email, coaching slots (2h each), membership upkeep, event hosting (6h) and support load. Leftover hours build products. Hustle mode gives +4h at a wellbeing cost; rest days restore wellbeing; low wellbeing cuts hours and quality. The planning board, chair and virtual assistant upgrades add capacity. | `engine/economy.ts` (`hoursBreakdown`), `config/balance.ts`, `config/events.ts` (exhausted) |
| **P12 Infrastructure and payments** | Revenue settles into **cash a day later** (revenue ≠ cash). Events: power cut (buy fuel or lose hours), network outage, payout delays, laptop repair. Counterplay upgrades: Inverter & Solar Battery, Backup MiFi Router, Secure Product Hosting (payment options). Daily data costs. | `engine/simulate.ts` (pendingPayouts), `config/events.ts`, `config/upgrades.ts` |
| **P13 Community and events** | Memberships renew weekly with churn that depends on satisfaction, quality and upkeep. Community path: lower churn, larger events. Events have seat capacity and a fixed date; full rooms raise reputation, empty seats hurt it. | `engine/simulate.ts`, `config/products.ts`, `config/paths.ts` |
| **P14 Piracy** | "Your product is being pirated" event lowers demand for ebooks and templates unless you buy Secure Product Hosting or send takedowns. | `config/events.ts` (piracy) |
| **P15 Discoverability** | Writer path: low organic reach (0.75×) offset by strong email (opt-in 1.6×, email conversion 1.35×) and repeat buyers on new launches (2.2×). | `config/paths.ts` |
| **P16 Brand deals** | "Brand deal offer" event pays cash (in 2 days) for hours, and slightly dilutes audience fit. It is more frequent for video creators. | `config/events.ts` (brand-deal) |

## Creator paths (PRD §4) and their evidence base

| Path | Functional effects | Informed by |
|---|---|---|
| Knowledge | High ebook/course skill, course early, posts take 3h, higher course price tolerance | P2, P7 (WakaWaka Doctor, Chidera Peters, Felix Ohaeri) |
| Video & Media | Large audience with low fit, 1.2× organic reach with high variance, quality depends on gear (equipment sensitivity 1.4), more brand deals and virality | P3, P16 (Techpoint YouTuber article, Polan, Chibuzor Ossai) |
| Writer & Storyteller | Ebooks are 45% faster and 70% cheaper to set up, strong email and repeat buyers, weak discoverability | P15, P3 (Busayo Joan, Stephanie Odili, OkadaBooks) |
| Coach & Service | High coaching skill and price tolerance, high starting reputation, fit 0.8; growth limited by hours | P11 (coaching capacity; Ransford comparator) |
| Community & Events | Membership and events early, 40% lower churn, +15 event seats, cheaper event setup | P13 (Calabar Tech Community, Oo Nwoye, Social Media Oga's community) |

## Creator Story cards (fictional) → patterns

| Card (fictional) | Unlocks | Inspired by patterns |
|---|---|---|
| The Borrowed Phone | Objective: 3 posts | P1 |
| The Doctor's Guide | First sale | P2, P6 |
| Six Copies on Day One | A paid product with ≤2 sales after 3 days live | P8 |
| The Rate Card | Reach Side Hustler | P5 |
| Small but Mighty | Reach Growing Creator | P3 |
| An Army of Promoters | 5 affiliates | P4 |
| The List That Survived | 100 subscribers | P3, P9 |
| Spend One, Earn Three | 2 days of ads | P7 |
| The Bad Batch | 75 satisfaction with 30 sales | P8, P10 |
| Rest Is a Strategy | Wellbeing drops below 45 | P11 |
| Generator Economics | ₦50,000 cash cushion | P12 |
| Collecting the Money | Reach Digital Entrepreneur | P12 |
| Five People in a Group Chat | 15 members or host an event | P6, P13 |
| The Shared PDF | Experience a piracy event | P14 |

## Win condition and scoring (PRD §8, §13)

- **Win:** by day 30, reach Growing Creator (₦250,000 net revenue), finish with **net profit > 0**, and have satisfaction ≥ 55. Revenue at a loss does not win. All three values are configurable in `config/balance.ts`.
- **Loss:** cash negative for 3 consecutive days (insolvency).
- **Score:** profit (1 point per ₦100, losses count double), plus revenue under a square root so it can't dominate, plus audience growth weighted by fit, reputation, satisfaction, objectives, rank and outcome. See `engine/scoring.ts`.

## Findings deliberately not implemented

Currency and tax mechanics, family financial obligations, trading or forex products, and any real-world earnings benchmarks. Reasons are given in `creator-economy-research.md` §5.
