import { memo, useMemo } from 'react';
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
import { useShallow } from 'zustand/react/shallow';
import { useDesignStore } from '../../state/designStore';
import { formatPct } from '../../ui/format';
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

/** More series than categorical colours would be unreadable; show the first eight. */
const MAX_SERIES = SERIES.length;

function UtilizationChartView() {
  const history = useChartHistory();
  // Only ids and labels matter here; dragging nodes around must not redraw the chart.
  const series = useDesignStore(
    useShallow((s) =>
      s.design.nodes.filter((n) => n.kind !== 'client').map((n) => `${n.id}\u0000${n.label}`),
    ),
  );
  // Colour follows the node's position in the design, so filtering never repaints survivors.
  const tracked = useMemo(
    () =>
      series.slice(0, MAX_SERIES).map((key) => {
        const [id = '', label = ''] = key.split('\u0000');
        return { id, label };
      }),
    [series],
  );
  const hidden = series.length - tracked.length;
  const chart = useMemo(
    () => (
      <ResponsiveContainer width="100%" height="100%" debounce={120}>
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
    ),
    [history, tracked],
  );
  return (
    <ChartCard title="Utilization per node" value={hidden > 0 ? `+${hidden} not shown` : undefined}>
      {chart}
    </ChartCard>
  );
}

export const UtilizationChart = memo(UtilizationChartView);
