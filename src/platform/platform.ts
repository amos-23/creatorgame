// Platform adapter. The game talks to hosting platforms only through this
// interface so the single-player game never depends on a platform being present.
//
// Only a local adapter is implemented: identity is the name the player typed and
// scores are kept on this device. Local scores are always labelled as local and
// are never presented as official platform scores. A future platform adapter
// (for example Vatar's Games SDK, see docs/vatar-integration.md) can implement the
// same interface.

import { defaultStorage, type StorageLike } from "../persistence/save";

export interface ScoreEntry {
  name: string;
  score: number;
  grade: string;
  path: string;
  day: string; // ISO date
}

export interface PlatformAdapter {
  readonly id: string;
  readonly official: boolean; // true only for a verified platform leaderboard
  readonly label: string;
  init(): Promise<{ playerName: string | null }>;
  submitScore(entry: ScoreEntry): Promise<{ accepted: boolean; best: number }>;
  leaderboard(): Promise<ScoreEntry[]>;
  onPause(fn: () => void): void;
  onResume(fn: () => void): void;
}

const LB_KEY = "creator-hustle/local-scores/v1";

export class LocalPlatform implements PlatformAdapter {
  readonly id = "local";
  readonly official = false;
  readonly label = "Local scores on this device";
  constructor(private storage: StorageLike | null = defaultStorage()) {}

  async init() {
    return { playerName: null };
  }

  private read(): ScoreEntry[] {
    try {
      const raw = this.storage?.getItem(LB_KEY);
      const list = raw ? (JSON.parse(raw) as ScoreEntry[]) : [];
      return Array.isArray(list) ? list.filter((e) => e && typeof e.score === "number").slice(0, 10) : [];
    } catch {
      return [];
    }
  }

  async submitScore(entry: ScoreEntry) {
    const list = [...this.read(), entry].sort((a, b) => b.score - a.score).slice(0, 10);
    try {
      this.storage?.setItem(LB_KEY, JSON.stringify(list));
    } catch {
      /* storage unavailable: scores are simply not kept */
    }
    return { accepted: true, best: list[0]?.score ?? entry.score };
  }

  async leaderboard() {
    return this.read();
  }

  onPause(fn: () => void) {
    document.addEventListener("visibilitychange", () => document.hidden && fn());
  }

  onResume(fn: () => void) {
    document.addEventListener("visibilitychange", () => !document.hidden && fn());
  }
}

export function createPlatform(): PlatformAdapter {
  return new LocalPlatform();
}
