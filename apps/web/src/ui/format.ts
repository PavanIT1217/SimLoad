const UNITS: [number, string][] = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
];

/** Compact number: 1234 -> "1.23k", 2500000 -> "2.5M". */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  const abs = Math.abs(value);
  for (const [scale, suffix] of UNITS) {
    if (abs >= scale) return `${trim(value / scale)}${suffix}`;
  }
  if (abs > 0 && abs < 10) return trim(value);
  return Math.round(value).toString();
}

function trim(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return Number(value.toFixed(digits)).toString();
}

export function formatRps(rps: number): string {
  return `${formatCompact(rps)} req/s`;
}

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return '∞';
  if (ms >= 10_000) return `${trim(ms / 1000)} s`;
  if (ms >= 100) return `${Math.round(ms)} ms`;
  return `${trim(ms)} ms`;
}

export function formatPct(fraction: number, digits = 1): string {
  if (!Number.isFinite(fraction)) return '–';
  const pct = fraction * 100;
  if (pct > 0 && pct < 0.01) return '<0.01%';
  return `${pct.toFixed(pct < 1 && pct > 0 ? 2 : digits)}%`;
}

export function formatSimTime(ms: number): string {
  const totalS = Math.floor(ms / 1000);
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** "$1,234" (or "$0.42" below one dollar). */
export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return '–';
  if (amount < 1) return `$${amount.toFixed(2)}`;
  if (amount >= 1e6) return `$${formatCompact(amount)}`;
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}
