import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSimStore } from '../../state/simStore';
import { formatPct } from '../../ui/format';
import { ChartCard } from './ChartCard';
import { AXIS_PROPS, GRID_PROPS, LINE_PROPS, TOOLTIP_PROPS, timeTick } from './chartTheme';

export function ErrorChart() {
  const history = useSimStore((s) => s.history);
  const last = history[history.length - 1];
  return (
    <ChartCard title="Error rate" value={last ? formatPct(last.errorRate, 2) : undefined}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="t" {...AXIS_PROPS} tickFormatter={timeTick} minTickGap={24} />
          <YAxis
            {...AXIS_PROPS}
            width={52}
            domain={[0, (max: number) => Math.max(0.01, max)]}
            tickFormatter={(v: number) => formatPct(v, 0)}
          />
          <Tooltip {...TOOLTIP_PROPS} formatter={(v) => formatPct(Number(v), 2)} />
          <Area
            {...LINE_PROPS}
            dataKey="errorRate"
            name="Errors"
            stroke="var(--bad)"
            fill="var(--bad-bg)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
