import type { RequestTrace, SpanOutcome } from '@syssim/engine';
import { useState } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import { formatMs } from '../../ui/format';

const OUTCOME_LABEL: Record<SpanOutcome, string> = {
  ok: 'ok',
  hit: 'cache hit',
  enqueued: 'enqueued',
  dropped: 'dropped',
  timeout: 'timeout',
  error: 'error',
  unavailable: 'unavailable',
};

function TraceWaterfall({ trace }: { trace: RequestTrace }) {
  const nodes = useDesignStore((s) => s.design.nodes);
  const label = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;
  const total = Math.max(trace.latencyMs, 0.001);
  return (
    <div className="waterfall" role="table" aria-label={`Trace #${trace.id}`}>
      {trace.spans.map((span, i) => (
        <div key={i} className="waterfall-row" role="row">
          <span className="waterfall-name" role="cell" style={{ paddingLeft: span.depth * 10 }}>
            {label(span.nodeId)}
            {span.attempt > 0 && <span className="waterfall-retry"> retry {span.attempt}</span>}
          </span>
          <span className="waterfall-track" role="cell">
            <span
              className={`waterfall-bar outcome-${span.outcome}`}
              style={{
                left: `${Math.min(100, (span.startMs / total) * 100)}%`,
                width: `${Math.max(0.5, Math.min(100, (span.durationMs / total) * 100))}%`,
              }}
            />
          </span>
          <span className="waterfall-meta mono" role="cell">
            {formatMs(span.durationMs)} · {OUTCOME_LABEL[span.outcome]}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TraceViewer() {
  const traces = useSimStore((s) => s.traces);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const recent = [...traces].reverse();
  const selected = recent.find((t) => t.id === selectedId) ?? recent[0];
  return (
    <figure className="chart-card trace-viewer">
      <figcaption className="chart-card-header">
        <span>Sampled request traces</span>
        <span className="muted small">{traces.length} recent</span>
      </figcaption>
      {recent.length === 0 ? (
        <p className="muted small trace-empty">Run the simulation to sample requests.</p>
      ) : (
        <div className="trace-body">
          <ul className="trace-list">
            {recent.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`trace-item ${t.id === selected?.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(t.id)}
                >
                  <span className={`trace-dot ${t.ok ? 'is-ok' : 'is-bad'}`} aria-hidden="true" />
                  <span className="mono">#{t.id}</span>
                  <span className="muted">{t.cls}</span>
                  <span className="mono trace-latency">{formatMs(t.latencyMs)}</span>
                  <span className="sr-only">{t.ok ? 'succeeded' : 'failed'}</span>
                </button>
              </li>
            ))}
          </ul>
          {selected && <TraceWaterfall trace={selected} />}
        </div>
      )}
    </figure>
  );
}
