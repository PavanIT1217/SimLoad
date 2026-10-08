import { useMemo, useState } from 'react';
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
import { useDesignStore } from '../../state/designStore';
import type { RunPoint } from '../../state/runsStore';
import { MAX_RUNS, summarizeRun, toRunPoints, useRunsStore } from '../../state/runsStore';
import { useSimStore } from '../../state/simStore';
import { Button } from '../../ui/Button';
import { formatCompact, formatMs, formatPct, formatSimTime } from '../../ui/format';
import {
  AXIS_PROPS,
  GRID_PROPS,
  LEGEND_PROPS,
  LINE_PROPS,
  SERIES,
  TOOLTIP_PROPS,
} from './chartTheme';

type Metric = 'p99' | 'p50' | 'throughput' | 'errorRate';
const METRICS: { id: Metric; label: string; format(v: number): string }[] = [
  { id: 'p99', label: 'p99 latency', format: formatMs },
  { id: 'p50', label: 'p50 latency', format: formatMs },
  { id: 'throughput', label: 'Goodput', format: (v) => `${formatCompact(v)}/s` },
  { id: 'errorRate', label: 'Error rate', format: (v) => formatPct(v, 2) },
];

/** Overlay the current run against saved runs on a common time axis. */
export function CompareView() {
  const history = useSimStore((s) => s.history);
  const designName = useDesignStore((s) => s.design.name);
  const { runs, save, remove, toggle } = useRunsStore();
  const [metric, setMetric] = useState<Metric>('p99');
  const fmt = METRICS.find((m) => m.id === metric)?.format ?? formatMs;
  const current = useMemo(() => toRunPoints(history), [history]);

  // Merge all series into rows keyed by relative time (rounded to 0.5 s).
  const data = useMemo(() => {
    const rows = new Map<number, Record<string, number>>();
    const add = (key: string, points: readonly RunPoint[]) => {
      for (const p of points) {
        const t = Math.round(p.t * 2) / 2;
        const row = rows.get(t) ?? { t };
        row[key] = p[metric];
        rows.set(t, row);
      }
    };
    add('current', current);
    for (const r of runs) if (r.visible) add(r.id, r.points);
    return [...rows.values()].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
  }, [current, runs, metric]);

  const currentSummary = summarizeRun(current);
  return (
    <div className="compare">
      <div className="compare-side">
        <div className="compare-controls">
          <select
            className="input"
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
            aria-label="Metric"
          >
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="primary"
            disabled={history.length < 5}
            onClick={() =>
              save(`${designName} · T+${formatSimTime((history.at(-1)?.t ?? 0) * 1000)}`, history)
            }
            title={`Keeps the last ${MAX_RUNS} runs`}
          >
            Save run
          </Button>
        </div>
        <table className="compare-table mono">
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">p99</th>
              <th scope="col">err</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <span className="swatch" style={{ background: 'var(--text)' }} /> Current
              </th>
              <td>{formatMs(currentSummary.p99)}</td>
              <td>{formatPct(currentSummary.errorRate, 2)}</td>
              <td />
            </tr>
            {runs.map((r, i) => (
              <tr key={r.id} className={r.visible ? '' : 'is-hidden'}>
                <th scope="row">
                  <label className="run-toggle" title={r.label}>
                    <input type="checkbox" checked={r.visible} onChange={() => toggle(r.id)} />
                    <span className="swatch" style={{ background: SERIES[i] }} />
                    <span className="run-label">{r.label}</span>
                  </label>
                </th>
                <td>{formatMs(r.summary.p99)}</td>
                <td>{formatPct(r.summary.errorRate, 2)}</td>
                <td>
                  <button
                    type="button"
                    className="run-remove"
                    onClick={() => remove(r.id)}
                    aria-label={`Delete ${r.label}`}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {runs.length === 0 && (
          <p className="muted small">Save a run, change the design, run again and compare.</p>
        )}
      </div>
      <figure className="chart-card hud compare-chart">
        <ResponsiveContainer width="100%" height="100%" debounce={120}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis
              dataKey="t"
              {...AXIS_PROPS}
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(t: number) => `${Math.round(t)}s`}
            />
            <YAxis {...AXIS_PROPS} width={56} tickFormatter={(v: number) => fmt(v)} />
            <Tooltip {...TOOLTIP_PROPS} formatter={(v) => fmt(Number(v))} />
            <Legend {...LEGEND_PROPS} />
            <Line
              {...LINE_PROPS}
              dataKey="current"
              name="Current"
              stroke="var(--text)"
              connectNulls
            />
            {runs.map((r, i) =>
              r.visible ? (
                <Line
                  key={r.id}
                  {...LINE_PROPS}
                  dataKey={r.id}
                  name={r.label}
                  stroke={SERIES[i]}
                  strokeDasharray="5 3"
                  connectNulls
                />
              ) : null,
            )}
          </LineChart>
        </ResponsiveContainer>
      </figure>
    </div>
  );
}
