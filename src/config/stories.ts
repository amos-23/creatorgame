// Creator Story cards: short, ORIGINAL, FICTIONAL composite scenarios.
// They are inspired by recurring patterns found in the research pack
// (see research/design-mapping.md), not by any single real person. No real names,
// likenesses or income figures are used at runtime.

export interface StoryCard {
  id: string;
  title: string;
  character: string; // fictional
  story: string;
  lesson: string;
  tip: string;
  /** Pattern ids from research/design-mapping.md that inspired this card. */
  patterns: string[];
}

export const STORIES: StoryCard[] = [
  {
    id: "start-with-what-you-have",
    title: "The Borrowed Phone",
    character: "Ada, food creator (fictional)",
    story:
      "Ada filmed her first recipes on a friend's phone, pausing whenever it rang. The videos were rough, but she posted anyway. Months later, brands were messaging her first.",
    lesson: "Start with the tools you have. Upgrade when the business can pay for it.",
    tip: "Buy gear after your first sales, not before. Upgrades should earn their cost back.",
    patterns: ["P1-start-small"],
  },
  {
    id: "expertise-to-product",
    title: "The Doctor's Guide",
    character: "Dr. Tunde, travel creator (fictional)",
    story:
      "After years working abroad, Tunde's followers kept asking the same visa questions. He wrote the answers into a guide, then added paid consultations for people who wanted more help.",
    lesson: "Questions your audience keeps asking are product ideas.",
    tip: "Products on your niche topic convert better. Once one sells, related offers launch cheaper.",
    patterns: ["P2-expertise-to-product", "P6-diversify"],
  },
  {
    id: "weak-launch",
    title: "Six Copies on Day One",
    character: "Ifeoma, style writer (fictional)",
    story:
      "Ifeoma's first ebook sold six copies on launch day. Instead of quitting, she studied what her readers struggled with, improved the guide and promoted it every day. Sales grew week after week.",
    lesson: "A weak launch is data, not a verdict.",
    tip: "Use Improve on a struggling product and keep promoting it. Quality lowers refunds and lifts sales.",
    patterns: ["P8-recovery"],
  },
  {
    id: "dont-underprice",
    title: "The Rate Card",
    character: "Kemi, location creator (fictional)",
    story:
      "A café offered Kemi a tiny fee for four videos. She said no, set a proper rate card, and soon landed better-paying work from brands that valued an engaged audience.",
    lesson: "Underpricing attracts the wrong customers and burns your time.",
    tip: "Very low prices can bring more sales but less profit and lower perceived value. Test prices.",
    patterns: ["P5-pricing"],
  },
  {
    id: "small-relevant-audience",
    title: "Small but Mighty",
    character: "Bayo, finance explainer (fictional)",
    story:
      "Bayo had 20,000 followers while a comedy page nearby had ten times more. But his followers wanted exactly what he sold, and his small list out-earned their big reach.",
    lesson: "Relevance beats raw follower count.",
    tip: "Watch Audience Fit. Organic posts and email build fit; broad ads and viral spikes dilute it.",
    patterns: ["P3-relevance"],
  },
  {
    id: "affiliates",
    title: "An Army of Promoters",
    character: "Zainab, ebook author (fictional)",
    story:
      "Zainab offered other creators a share of every sale. Her readers' friends started promoting the book in their own communities, and sales reached cities she had never posted to.",
    lesson: "Affiliates extend your reach, but every sale shares the margin.",
    tip: "Higher commission recruits affiliates faster but cuts profit per sale. Proven products attract more.",
    patterns: ["P4-affiliates"],
  },
  {
    id: "direct-audience",
    title: "The List That Survived",
    character: "Chidi, tech tutor (fictional)",
    story:
      "When Chidi's main social account was suspended for a week, his sales barely dipped. He had been collecting emails with a free checklist, and his subscribers kept buying.",
    lesson: "Own a direct line to your audience. Platforms can change overnight.",
    tip: "A free lead magnet (price ₦0) grows your email list fast. Email traffic converts best.",
    patterns: ["P3-relevance", "P9-platform-risk"],
  },
  {
    id: "ads-with-roi",
    title: "Spend One, Earn Three",
    character: "Emeka, AI course creator (fictional)",
    story:
      "Emeka tracked every naira of ad spend against course sales. When the numbers worked he scaled up; when an ad grew stale he paused it and tested a fresh angle.",
    lesson: "Paid ads are a tool, not a magic button. Measure return on spend.",
    tip: "Check the ad return in your daily report. Ads tire over time; new products and creatives refresh them.",
    patterns: ["P7-paid-ads"],
  },
  {
    id: "bad-batch",
    title: "The Bad Batch",
    character: "Sade, skincare seller turned creator (fictional)",
    story:
      "A faulty batch upset Sade's customers. She refunded them and sent extras. One angry buyer became her loudest fan and sent friends her way.",
    lesson: "How you handle mistakes builds more trust than never making one.",
    tip: "Generous refunds cost cash now but protect reputation and satisfaction for every future sale.",
    patterns: ["P8-recovery", "P10-satisfaction"],
  },
  {
    id: "rest",
    title: "Rest Is a Strategy",
    character: "Tobi, daily vlogger (fictional)",
    story:
      "Tobi posted every day for months until the ideas dried up. After a planned week off and a batching routine, he made better videos in less time.",
    lesson: "Burnout quietly lowers quality. Rest protects the business.",
    tip: "Low wellbeing reduces your hours and product quality. Rest days and the planning board help.",
    patterns: ["P11-capacity"],
  },
  {
    id: "power-and-data",
    title: "Generator Economics",
    character: "Funmi, course creator (fictional)",
    story:
      "Funmi lost a recording day to a power cut and another to a dead network. She set aside part of each week's income for an inverter and a backup router.",
    lesson: "Infrastructure is part of the business plan.",
    tip: "Backup power and internet remove the worst operational shocks. Keep a cash reserve for surprises.",
    patterns: ["P12-infrastructure"],
  },
  {
    id: "getting-paid",
    title: "Collecting the Money",
    character: "Uche, novelist (fictional)",
    story:
      "Uche had readers who wanted his book, but collecting payments was harder than selling. A proper checkout and payment options turned interest into income.",
    lesson: "Payment friction loses sales and delays cash.",
    tip: "Revenue is not cash. Payouts settle a day later, and delays can stretch that. Plan spending around it.",
    patterns: ["P12-infrastructure"],
  },
  {
    id: "community-to-event",
    title: "Five People in a Group Chat",
    character: "Amaka, community builder (fictional)",
    story:
      "Amaka's community began as five friends in a group chat. Years of useful meetups later, hundreds of people came to her first big conference.",
    lesson: "Communities compound when you show up consistently.",
    tip: "Memberships pay weekly but members leave if you neglect them. Events reward a full room.",
    patterns: ["P6-diversify", "P13-community"],
  },
  {
    id: "piracy",
    title: "The Shared PDF",
    character: "Ngozi, template designer (fictional)",
    story:
      "Ngozi found her template pack being passed around in group chats. She moved to view-only delivery with watermarks and focused on updates that only paying customers received.",
    lesson: "Protect digital products, but compete on value and updates.",
    tip: "Secure Product Hosting blocks piracy events.",
    patterns: ["P14-piracy"],
  },
];

export const STORY_BY_ID: Record<string, StoryCard> = Object.fromEntries(STORIES.map((s) => [s.id, s]));
