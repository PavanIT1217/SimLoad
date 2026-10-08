export type InsightSeverity = 'critical' | 'warning' | 'info' | 'ok';

/** A finding about the running system, with concrete things to try. */
export interface Insight {
  id: string;
  severity: InsightSeverity;
  nodeId?: string;
  title: string;
  detail: string;
  suggestions: string[];
}

export const SEVERITY_RANK: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  ok: 3,
};

/** Compact number for insight text: 1234 -> "1.2k", 2.5e6 -> "2.5M". */
export function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${+(n / 1e9).toFixed(1)}G`;
  if (abs >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${+(n / 1e3).toFixed(1)}k`;
  if (abs >= 10) return `${Math.round(n)}`;
  return `${+n.toFixed(2)}`;
}

export function fmtMs(ms: number): string {
  return ms >= 1000 ? `${+(ms / 1000).toFixed(1)} s` : `${+ms.toFixed(ms < 10 ? 1 : 0)} ms`;
}

export function pct(f: number): string {
  return `${+(f * 100).toFixed(f < 0.01 ? 2 : 0)}%`;
}
