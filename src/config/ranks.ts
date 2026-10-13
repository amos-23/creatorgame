// Creator ranks. Thresholds are cumulative net revenue (gross revenue minus refunds).
// The values follow the PRD and are configurable here.

export interface Rank {
  id: string;
  name: string;
  threshold: number;
  icon: string;
  perk: string;
}

export const RANKS: Rank[] = [
  { id: "beginner", name: "Beginner", threshold: 0, icon: "🌱", perk: "A borrowed corner and a big idea." },
  { id: "side", name: "Side Hustler", threshold: 50_000, icon: "⚡", perk: "Courses and new upgrades unlocked." },
  { id: "growing", name: "Growing Creator", threshold: 250_000, icon: "📈", perk: "Memberships, events and pro gear unlocked." },
  { id: "entrepreneur", name: "Digital Entrepreneur", threshold: 1_000_000, icon: "💼", perk: "Studio makeover unlocked." },
  { id: "boss", name: "Creator Boss", threshold: 5_000_000, icon: "👑", perk: "Your studio is the envy of the timeline." },
  { id: "mogul", name: "Digital Mogul", threshold: 20_000_000, icon: "🏆", perk: "A creator business built to last." },
];

export const FIRST_SALE_MILESTONE = "first-sale";
