import { diagnose } from '@simload/engine';
import type { Insight, InsightSeverity } from '@simload/engine';
import { useMemo } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { Section } from '../../ui/Section';
import { CostBreakdownView } from './CostBreakdownView';
import './insights.css';

const ICON: Record<InsightSeverity, string> = {
  critical: '▲',
  warning: '◆',
  info: '●',
  ok: '✓',
};

function InsightCard({ insight }: { insight: Insight }) {
  const select = useDesignStore((s) => s.select);
  const setTab = useUiStore((s) => s.setRightTab);
  return (
    <article className={`insight sev-${insight.severity}`}>
      <header className="insight-head">
        <span className="insight-icon" aria-hidden="true">
          {ICON[insight.severity]}
        </span>
        <h4>{insight.title}</h4>
        <span className="sr-only">Severity: {insight.severity}</span>
      </header>
      <p className="insight-detail">{insight.detail}</p>
      {insight.suggestions.length > 0 && (
        <ul className="insight-fixes">
          {insight.suggestions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      {insight.nodeId && (
        <button
          type="button"
          className="insight-link"
          onClick={() => {
            select({ type: 'node', id: insight.nodeId as string });
            setTab('inspect');
          }}
        >
          Inspect node →
        </button>
      )}
    </article>
  );
}

/** Plain-language analysis of what limits the system right now. */
export function InsightsPanel() {
  const design = useDesignStore((s) => s.design);
  const latest = useSimStore((s) => s.latest);
  const insights = useMemo(() => diagnose(design, latest), [design, latest]);
  return (
    <div className="panel-pad">
      <Section title="Bottleneck analysis">
        {!latest ? (
          <p className="muted small">Run the simulation to analyse the design under load.</p>
        ) : (
          <div className="insight-list" aria-live="polite">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        )}
      </Section>
      <CostBreakdownView />
    </div>
  );
}
