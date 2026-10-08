import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import { formatPct } from '../../ui/format';
import { ChartCard } from './ChartCard';
import {
  AXIS_PROPS,
  GRID_PROPS,
  LEGEND_PROPS,
  LINE_PROPS,
  SERIES,
  TOOLTIP_PROPS,
  timeTick,
} from './chartTheme';

/** More series than categorical colours would be unreadable; show the first eight. */
const MAX_SERIES = SERIES.length;

export function UtilizationChart() {
  const history = useSimStore((s) => s.history);
  const nodes = useDesignStore((s) => s.design.nodes);
  // Colour follows the node's position in the design, so filtering never repaints survivors.
  const tracked = nodes.filter((n) => n.kind !== 'client').slice(0, MAX_SERIES);
  const hidden = nodes.filter((n) => n.kind !== 'client').length - tracked.length;
  return (
    <ChartCard title="Utilization per node" value={hidden > 0 ? `+${hidden} not shown` : undefined}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="t" {...AXIS_PROPS} tickFormatter={timeTick} minTickGap={24} />
          <YAxis
            {...AXIS_PROPS}
            width={52}
            domain={[0, (max: number) => Math.max(1.1, Math.min(max, 5))]}
            allowDataOverflow
            tickFormatter={(v: number) => formatPct(v, 0)}
          />
          <ReferenceLine y={1} stroke="var(--bad)" strokeDasharray="3 3" />
          <Tooltip {...TOOLTIP_PROPS} formatter={(v) => formatPct(Number(v), 0)} />
          <Legend {...LEGEND_PROPS} />
          {tracked.map((n, i) => (
            <Line
              key={n.id}
              {...LINE_PROPS}
              dataKey={(p: { util: Record<string, number> }) => p.util[n.id] ?? 0}
              name={n.label}
              stroke={SERIES[i]}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
