import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSimStore } from '../../state/simStore';
import { formatRps } from '../../ui/format';
import { ChartCard } from './ChartCard';
import {
  AXIS_PROPS,
  GRID_PROPS,
  LEGEND_PROPS,
  LINE_PROPS,
  SERIES,
  TOOLTIP_PROPS,
  compactTick,
  timeTick,
} from './chartTheme';

export function ThroughputChart() {
  const history = useSimStore((s) => s.history);
  const last = history[history.length - 1];
  return (
    <ChartCard
      title="Throughput vs offered load"
      value={last ? formatRps(last.throughput) : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="t" {...AXIS_PROPS} tickFormatter={timeTick} minTickGap={24} />
          <YAxis {...AXIS_PROPS} width={52} tickFormatter={compactTick} />
          <Tooltip {...TOOLTIP_PROPS} formatter={(v) => formatRps(Number(v))} />
          <Legend {...LEGEND_PROPS} />
          <Line
            {...LINE_PROPS}
            dataKey="offered"
            name="Offered"
            stroke={SERIES[0]}
            strokeDasharray="4 3"
          />
          <Line {...LINE_PROPS} dataKey="throughput" name="Goodput" stroke={SERIES[1]} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
