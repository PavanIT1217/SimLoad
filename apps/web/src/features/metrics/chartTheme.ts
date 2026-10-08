import { formatCompact } from '../../ui/format';

/** Categorical series colours, in fixed order (validated for CVD separation). */
export const SERIES = Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`);

export const AXIS_PROPS = {
  stroke: 'var(--text-faint)',
  tick: { fill: 'var(--text-muted)', fontSize: 10 },
  tickLine: false,
  axisLine: false,
} as const;

export const GRID_PROPS = {
  stroke: 'var(--grid)',
  vertical: false,
} as const;

export const TOOLTIP_PROPS = {
  contentStyle: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 11,
    color: 'var(--text)',
  },
  labelStyle: { color: 'var(--text-muted)' },
  itemStyle: { color: 'var(--text)' },
  labelFormatter: (t: unknown) => `t = ${Number(t).toFixed(1)}s`,
  isAnimationActive: false,
} as const;

export const LEGEND_PROPS = {
  iconSize: 8,
  wrapperStyle: { fontSize: 11, color: 'var(--text-muted)' },
} as const;

export const LINE_PROPS = {
  type: 'monotone',
  dot: false,
  strokeWidth: 2,
  isAnimationActive: false,
} as const;

export const timeTick = (t: number) => `${Math.round(t)}s`;
export const compactTick = (v: number) => formatCompact(v);
