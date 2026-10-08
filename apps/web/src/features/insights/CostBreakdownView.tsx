import { estimateCost } from '@simload/engine';
import { useMemo } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import { formatUsd } from '../../ui/format';
import { Section } from '../../ui/Section';

/** Monthly cost by component, using live instance counts and traffic. */
export function CostBreakdownView() {
  const design = useDesignStore((s) => s.design);
  const latest = useSimStore((s) => s.latest);
  const cost = useMemo(() => estimateCost(design, latest), [design, latest]);
  const rows = [...cost.nodes].sort((a, b) => b.monthly - a.monthly);
  const max = Math.max(1, ...rows.map((r) => r.monthly));
  return (
    <Section title={`Cost · ${formatUsd(cost.totalMonthly)}/mo`}>
      <table className="cost-table mono">
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col">Units</th>
            <th scope="col">$/mo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.nodeId}>
              <th scope="row">
                <span className="cost-label">{r.label}</span>
                <span className="cost-bar" style={{ width: `${(r.monthly / max) * 100}%` }} />
              </th>
              <td>{r.instances}</td>
              <td>{formatUsd(r.monthly)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        Fixed {formatUsd(cost.fixedMonthly)} + usage {formatUsd(cost.usageMonthly)} per month at the
        current load. Prices are editable per component (Inspect → Cost).
      </p>
    </Section>
  );
}
