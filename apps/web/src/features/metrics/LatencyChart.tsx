import { memo, useMemo } from 'react';
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
import { formatMs } from '../../ui/format';
import { ChartCard } from './ChartCard';
import { useChartHistory } from './useChartHistory';
import {
  AXIS_PROPS,
  GRID_PROPS,
  LEGEND_PROPS,
  LINE_PROPS,
  SERIES,
  TOOLTIP_PROPS,
  timeTick,
} from './chartTheme';

function LatencyChartView() {
  const history = useChartHistory();
  const last = history[history.length - 1];
  const chart = useMemo(
    () => (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="t" {...AXIS_PROPS} tickFormatter={timeTick} minTickGap={24} />
          <YAxis {...AXIS_PROPS} width={52} tickFormatter={(v: number) => formatMs(v)} />
          <Tooltip {...TOOLTIP_PROPS} formatter={(v) => formatMs(Number(v))} />
          <Legend {...LEGEND_PROPS} />
          <Line {...LINE_PROPS} dataKey="p50" name="p50" stroke={SERIES[0]} />
          <Line {...LINE_PROPS} dataKey="p95" name="p95" stroke={SERIES[1]} />
          <Line {...LINE_PROPS} dataKey="p99" name="p99" stroke={SERIES[2]} />
        </LineChart>
      </ResponsiveContainer>
    ),
    [history],
  );
  return (
    <ChartCard title="End-to-end latency" value={last ? `p99 ${formatMs(last.p99)}` : undefined}>
      {chart}
    </ChartCard>
  );
}

export const LatencyChart = memo(LatencyChartView);
