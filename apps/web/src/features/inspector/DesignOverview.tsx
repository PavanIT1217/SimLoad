import { validateDesign } from '@simload/engine';
import { useMemo } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import { formatMs, formatPct, formatRps } from '../../ui/format';
import { Section, Stat } from '../../ui/Section';

export function DesignOverview() {
  const design = useDesignStore((s) => s.design);
  const rename = useDesignStore((s) => s.rename);
  const select = useDesignStore((s) => s.select);
  const latest = useSimStore((s) => s.latest);
  const issues = useMemo(() => validateDesign(design), [design]);

  return (
    <div className="inspector-content">
      <header className="inspector-header">
        <div className="inspector-titles">
          <input
            className="input inspector-name"
            value={design.name}
            aria-label="Design name"
            onChange={(e) => rename(e.target.value)}
          />
          <span className="muted small">
            {design.nodes.length} components · {design.edges.length} connections
          </span>
        </div>
      </header>
      <Section title="System">
        <div className="stat-grid">
          <Stat label="Offered" value={formatRps(latest?.offeredRps ?? 0)} />
          <Stat label="Goodput" value={formatRps(latest?.throughputRps ?? 0)} />
          <Stat label="Error rate" value={formatPct(latest?.errorRate ?? 0, 2)} />
          <Stat label="Retry traffic" value={formatRps(latest?.retryRps ?? 0)} />
          <Stat label="p50" value={formatMs(latest?.latency.p50 ?? 0)} />
          <Stat label="p99" value={formatMs(latest?.latency.p99 ?? 0)} />
        </div>
      </Section>
      <Section title={`Validation (${issues.length})`}>
        {issues.length === 0 ? (
          <p className="muted small">No issues. Select a node or connection to edit it.</p>
        ) : (
          <ul className="issue-list">
            {issues.map((issue, i) => (
              <li key={i} className={`issue issue-${issue.severity}`}>
                <button
                  type="button"
                  className="issue-button"
                  disabled={!issue.nodeIds?.length}
                  onClick={() => {
                    const id = issue.nodeIds?.[0];
                    if (id) select({ type: 'node', id });
                  }}
                >
                  <strong>{issue.severity === 'error' ? 'Error' : 'Warning'}:</strong>{' '}
                  {issue.message}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
