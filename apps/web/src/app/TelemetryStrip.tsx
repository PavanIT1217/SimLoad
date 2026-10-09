import { estimateCost } from '@simload/engine';
import { memo } from 'react';
import { useDesignStore } from '../state/designStore';
import { useSimStore } from '../state/simStore';
import { formatCompact, formatMs, formatPct, formatUsd } from '../ui/format';

interface ReadoutProps {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad';
  /** Gets extra width, for labels that carry a node name. */
  wide?: boolean;
}

function Readout({ label, value, tone, wide }: ReadoutProps) {
  return (
    <div
      className={`readout ${tone ? `tone-${tone}` : ''} ${wide ? 'is-wide' : ''}`}
      title={`${label}: ${value}`}
    >
      <span className="readout-label">{label}</span>
      <span className="readout-value mono">{value}</span>
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
  const retryRps = latest?.retryRps ?? 0;
  return (
    <div className="telemetry" role="status" aria-label="System telemetry">
      <Readout label="Offered" value={`${formatCompact(latest?.offeredRps ?? 0)}/s`} />
      <Readout
        label="Goodput"
        value={`${formatCompact(latest?.throughputRps ?? 0)}/s`}
        tone={latest && latest.throughputRps < latest.offeredRps * 0.99 ? 'warn' : undefined}
      />
      <Readout
        label="Error rate"
        value={formatPct(err, 2)}
        tone={err > 0.01 ? 'bad' : err > 0.001 ? 'warn' : latest ? 'ok' : undefined}
      />
      <Readout label="p50 latency" value={formatMs(latest?.latency.p50 ?? 0)} />
      <Readout label="p99 latency" value={formatMs(latest?.latency.p99 ?? 0)} />
      {/* Only worth the space once retries actually happen. */}
      {retryRps > 0 && (
        <Readout label="Retry traffic" value={`${formatCompact(retryRps)}/s`} tone="warn" />
      )}
      <Readout label="Cost / month" value={formatUsd(cost)} />
      <Readout
        wide
        label="Bottleneck"
        value={bottleneck ? `${formatPct(rho, 0)} · ${bottleneck.label}` : '–'}
        tone={rho >= 0.9 ? 'bad' : rho >= 0.7 ? 'warn' : bottleneck ? 'ok' : undefined}
      />
    </div>
  );
}

export const TelemetryStrip = memo(TelemetryStripView);
