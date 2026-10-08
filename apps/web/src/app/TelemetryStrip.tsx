import { estimateCost } from '@syssim/engine';
import { memo } from 'react';
import { useDesignStore } from '../state/designStore';
import { useSimStore } from '../state/simStore';
import { formatCompact, formatMs, formatPct, formatUsd } from '../ui/format';

interface ReadoutProps {
  symbol: string;
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad';
}

function Readout({ symbol, label, value, tone }: ReadoutProps) {
  return (
    <div className={`readout ${tone ? `tone-${tone}` : ''}`} title={label}>
      <span className="readout-symbol">{symbol}</span>
      <span className="readout-body">
        <span className="readout-label">{label}</span>
        <span className="readout-value mono">{value}</span>
      </span>
    </div>
  );
}

/** System-wide telemetry: the numbers an operator watches first. */
function TelemetryStripView() {
  const latest = useSimStore((s) => s.latest);
  const design = useDesignStore((s) => s.design);
  const nodes = design.nodes;
  let bottleneck: { label: string; rho: number } | null = null;
  for (const state of Object.values(latest?.nodes ?? {})) {
    if (state.kind === 'client') continue;
    if (!bottleneck || state.saturation > bottleneck.rho) {
      const label = nodes.find((n) => n.id === state.id)?.label ?? state.id;
      bottleneck = { label, rho: state.saturation };
    }
  }
  const err = latest?.errorRate ?? 0;
  const cost = estimateCost(design, latest).totalMonthly;
  const rho = bottleneck?.rho ?? 0;
  return (
    <div className="telemetry" role="status" aria-label="System telemetry">
      <Readout symbol="λ" label="Offered" value={`${formatCompact(latest?.offeredRps ?? 0)}/s`} />
      <Readout
        symbol="X"
        label="Goodput"
        value={`${formatCompact(latest?.throughputRps ?? 0)}/s`}
        tone={latest && latest.throughputRps < latest.offeredRps * 0.99 ? 'warn' : undefined}
      />
      <Readout
        symbol="ε"
        label="Error rate"
        value={formatPct(err, 2)}
        tone={err > 0.01 ? 'bad' : err > 0.001 ? 'warn' : latest ? 'ok' : undefined}
      />
      <Readout symbol="P50" label="Median latency" value={formatMs(latest?.latency.p50 ?? 0)} />
      <Readout symbol="P95" label="p95 latency" value={formatMs(latest?.latency.p95 ?? 0)} />
      <Readout symbol="P99" label="p99 latency" value={formatMs(latest?.latency.p99 ?? 0)} />
      <Readout
        symbol="↻"
        label="Retry traffic"
        value={`${formatCompact(latest?.retryRps ?? 0)}/s`}
        tone={(latest?.retryRps ?? 0) > 0 ? 'warn' : undefined}
      />
      <Readout symbol="$" label="Cost / month" value={formatUsd(cost)} />
      <Readout
        symbol="ρ"
        label={`Bottleneck${bottleneck ? ` · ${bottleneck.label}` : ''}`}
        value={bottleneck ? formatPct(rho, 0) : '–'}
        tone={rho >= 0.9 ? 'bad' : rho >= 0.7 ? 'warn' : bottleneck ? 'ok' : undefined}
      />
    </div>
  );
}

export const TelemetryStrip = memo(TelemetryStripView);
