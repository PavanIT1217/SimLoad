import { memo, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatPct } from '../../ui/format';
import { ChartCard } from './ChartCard';
import { useReplayTime } from './useReplayTime';
import { useChartHistory } from './useChartHistory';
import { AXIS_PROPS, GRID_PROPS, LINE_PROPS, TOOLTIP_PROPS, timeTick } from './chartTheme';

function ErrorChartView() {
  const history = useChartHistory();
  const replayT = useReplayTime();
  const last = history[history.length - 1];
  const chart = useMemo(
    () => (
      <ResponsiveContainer width="100%" height="100%" debounce={120}>
        <AreaChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="t" {...AXIS_PROPS} tickFormatter={timeTick} minTickGap={24} />
          <YAxis
            {...AXIS_PROPS}
            width={52}
            domain={[0, (max: number) => Math.max(0.01, max)]}
            tickFormatter={(v: number) => formatPct(v, 0)}
          />
          {replayT !== null && (
            <ReferenceLine x={replayT} stroke="var(--accent-2)" strokeWidth={1.5} />
          )}
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
    ),
    [history, replayT],
  );
  return (
    <ChartCard title="Error rate" value={last ? formatPct(last.errorRate, 2) : undefined}>
      {chart}
    </ChartCard>
  );
}

export const ErrorChart = memo(ErrorChartView);
