// Save / load with validation. Saves are versioned JSON in localStorage (wrapped
// in try/catch: storage may be unavailable in private windows or embedded frames,
// in which case the game simply runs without persistence).

import { OBJECTIVES } from "../config/objectives";
import { PATHS, TOPICS } from "../config/paths";
import { PRODUCT_TYPES } from "../config/products";
import { UPGRADE_BY_ID } from "../config/upgrades";
import { SCHEMA_VERSION, defaultPlan, emptyLedger, emptyTotals } from "../engine/state";
import type { GameState } from "../engine/types";

export const SAVE_KEY = "creator-hustle/save/v1";
export const SETTINGS_KEY = "creator-hustle/settings/v1";

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export function defaultStorage(): StorageLike | null {
  try {
    const ls = globalThis.localStorage;
    const probe = "__ch_probe__";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

export interface LoadResult {
  state: GameState | null;
  status: "none" | "ok" | "invalid" | "outdated" | "unavailable";
  message?: string;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isArr = Array.isArray;

/** Returns a list of problems; empty means the save is structurally valid. */
export function validateState(raw: unknown): string[] {
  const errs: string[] = [];
  if (!raw || typeof raw !== "object") return ["not an object"];
  const s = raw as Record<string, unknown>;
  if (s.schemaVersion !== SCHEMA_VERSION) errs.push("schema version");
  if (!isNum(s.seed)) errs.push("seed");
  if (!isStr(s.path) || !(s.path in PATHS)) errs.push("path");
  if (!isStr(s.niche) || !(s.niche in TOPICS)) errs.push("niche");
  if (!isNum(s.day) || s.day < 1 || s.day > 60) errs.push("day");
  if (!isNum(s.campaignDays)) errs.push("campaignDays");
  if (s.phase !== "planning" && s.phase !== "ended") errs.push("phase");
  for (const k of ["cash", "audience", "audienceFit", "emailList", "emailFreshness", "affiliates", "reputation", "satisfaction", "wellbeing", "rank", "postsMade", "emailsSent", "adDays", "sideGigs", "negativeCashDays", "nextProductNumber", "hoursCommitted", "lastEventDay"]) {
    if (!isNum(s[k])) errs.push(k);
  }
  if (isNum(s.audience) && s.audience < 0) errs.push("audience negative");
  if (isNum(s.rank) && (s.rank < 0 || s.rank > 5)) errs.push("rank range");
  if (!isArr(s.products)) errs.push("products");
  else
    for (const p of s.products as Record<string, unknown>[]) {
      if (!p || !isStr(p.id) || !isStr(p.type) || !(p.type in PRODUCT_TYPES) || !isNum(p.price) || !isNum(p.quality) || !isStr(p.status) || !isArr(p.members)) {
        errs.push("product");
        break;
      }
    }
  if (!isArr(s.upgrades) || !(s.upgrades as unknown[]).every((u) => isStr(u) && u in UPGRADE_BY_ID)) errs.push("upgrades");
  if (new Set(s.upgrades as string[]).size !== (s.upgrades as unknown[] | undefined)?.length) errs.push("duplicate upgrades");
  if (!s.plan || typeof s.plan !== "object") errs.push("plan");
  else {
    const p = s.plan as Record<string, unknown>;
    if (!isNum(p.posts) || !isNum(p.adBudget) || !isBool(p.email) || !isBool(p.affiliateOn) || !isNum(p.affiliateCommission) || !isNum(p.coachingSlots)) errs.push("plan fields");
  }
  for (const k of ["modifiers", "pendingPayouts", "scheduledRefunds", "eventHistory", "history", "milestones", "objectives", "storiesUnlocked", "inbox", "dayFlags"]) {
    if (!isArr(s[k])) errs.push(k);
  }
  if (!s.totals || typeof s.totals !== "object") errs.push("totals");
  if (!s.dayLedger || typeof s.dayLedger !== "object") errs.push("dayLedger");
  if (isArr(s.history) && isNum(s.day) && s.phase === "planning" && (s.history as unknown[]).length !== s.day - 1) errs.push("history length");
  return errs;
}

/** Fill in fields added in later minor revisions so slightly older saves still load. */
function normalise(s: GameState): GameState {
  s.plan = { ...defaultPlan(), ...s.plan };
  s.totals = { ...emptyTotals(), ...s.totals };
  s.dayLedger = { ...emptyLedger(s.cash), ...s.dayLedger };
  const known = new Set(s.objectives.map((o) => o.id));
  for (const o of OBJECTIVES) if (!known.has(o.id)) s.objectives.push({ id: o.id, done: false, doneDay: null });
  s.avatar = s.avatar ?? { skin: 2, outfit: 0, hair: 0 };
  return s;
}

export function serialize(s: GameState): string {
  return JSON.stringify({ app: "creator-hustle", savedAt: Date.now(), state: s });
}

export function deserialize(text: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { state: null, status: "invalid", message: "The save file is corrupted." };
  }
  const wrapper = parsed as { app?: string; state?: unknown };
  if (!wrapper || wrapper.app !== "creator-hustle" || !wrapper.state) return { state: null, status: "invalid", message: "Not a Creator Hustle save." };
  const st = wrapper.state as Record<string, unknown>;
  if (isNum(st.schemaVersion) && st.schemaVersion !== SCHEMA_VERSION) {
    return { state: null, status: "outdated", message: "This save is from an older version and can't be resumed." };
  }
  const errs = validateState(st);
  if (errs.length) return { state: null, status: "invalid", message: `The save failed validation (${errs.slice(0, 3).join(", ")}).` };
  return { state: normalise(st as unknown as GameState), status: "ok" };
}

export function saveGame(s: GameState, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, serialize(s));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(storage: StorageLike | null = defaultStorage()): LoadResult {
  if (!storage) return { state: null, status: "unavailable" };
  let text: string | null = null;
  try {
    text = storage.getItem(SAVE_KEY);
  } catch {
    return { state: null, status: "unavailable" };
  }
  if (!text) return { state: null, status: "none" };
  return deserialize(text);
}

export function clearSave(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export interface Settings {
  sound: boolean;
  quality: "high" | "low";
  simplified: boolean;
  reducedMotion: boolean;
}

export function defaultSettings(): Settings {
  const prefersReduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { sound: true, quality: "high", simplified: false, reducedMotion: prefersReduced };
}

export function loadSettings(storage: StorageLike | null = defaultStorage()): Settings {
  const d = defaultSettings();
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      sound: typeof p.sound === "boolean" ? p.sound : d.sound,
      quality: p.quality === "low" ? "low" : "high",
      simplified: typeof p.simplified === "boolean" ? p.simplified : d.simplified,
      reducedMotion: typeof p.reducedMotion === "boolean" ? p.reducedMotion : d.reducedMotion,
    };
  } catch {
    return d;
  }
}

export function saveSettings(s: Settings, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
