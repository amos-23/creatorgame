// Deterministic, seedable random number generation.
// Each simulated day gets its own stream derived from (seed, day, salt), so the
// outcome of a day depends only on the seed and the player's decisions — not on
// how many times the UI happened to call the RNG before.

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(...parts: (number | string)[]): number {
  let h = 2166136261 >>> 0;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= 0x9e3779b9;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function dayRng(seed: number, day: number, salt = "day"): Rng {
  return mulberry32(hashSeed(seed, day, salt));
}

/** Standard normal via Box-Muller. */
export function normal(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Log-normal multiplier with median 1. */
export function lognormal(rng: Rng, sigma: number): number {
  return Math.exp(normal(rng) * sigma - (sigma * sigma) / 2);
}

/**
 * Integer count of successes with the given expected value.
 * Uses Poisson sampling for small means and a normal approximation for large ones.
 */
export function sampleCount(rng: Rng, mean: number): number {
  if (!(mean > 0)) return 0;
  if (mean < 30) {
    const l = Math.exp(-mean);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rng();
    } while (p > l);
    return k - 1;
  }
  return Math.max(0, Math.round(mean + normal(rng) * Math.sqrt(mean)));
}

export function pickWeighted<T>(rng: Rng, items: T[], weight: (t: T) => number): T | null {
  const total = items.reduce((s, it) => s + Math.max(0, weight(it)), 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1] ?? null;
}

export function randomSeed(): number {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0]!;
  }
  return Math.floor(Math.random() * 2 ** 32);
}
