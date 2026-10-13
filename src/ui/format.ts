export const naira = (n: number, opts: { sign?: boolean; compact?: boolean } = {}): string => {
  const v = Math.round(n);
  const sign = v < 0 ? "−" : opts.sign && v > 0 ? "+" : "";
  const a = Math.abs(v);
  if (opts.compact && a >= 1_000_000) return `${sign}₦${(a / 1_000_000).toFixed(a >= 10_000_000 ? 1 : 2)}M`;
  if (opts.compact && a >= 10_000) return `${sign}₦${(a / 1000).toFixed(a >= 100_000 ? 0 : 1)}k`;
  return `${sign}₦${a.toLocaleString("en-NG")}`;
};

export const num = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toLocaleString("en-NG");
};

export const pct = (v: number): string => `${Math.round(v * 100)}%`;

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const stars = (q: number): string => {
  const n = Math.max(1, Math.min(5, Math.round(q * 4)));
  return "★".repeat(n) + "☆".repeat(5 - n);
};

export const qualityLabel = (q: number): string =>
  q >= 1.05 ? "Outstanding" : q >= 0.9 ? "Excellent" : q >= 0.75 ? "Good" : q >= 0.6 ? "Decent" : "Rough";
