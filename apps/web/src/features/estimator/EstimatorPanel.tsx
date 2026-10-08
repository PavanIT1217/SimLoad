import { useState } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';
import { Field, NumberInput } from '../../ui/Field';
import { formatCompact, formatPct } from '../../ui/format';
import { Section, Stat } from '../../ui/Section';
import type { EstimateInput } from './estimate';
import { DEFAULT_ESTIMATE, estimate, formatBytes } from './estimate';

const INPUTS: { key: keyof EstimateInput; label: string; step?: number }[] = [
  { key: 'dailyActiveUsers', label: 'Daily active users' },
  { key: 'requestsPerUserPerDay', label: 'Requests / user / day' },
  { key: 'peakFactor', label: 'Peak ÷ average', step: 0.5 },
  { key: 'readsPerWrite', label: 'Reads per write' },
  { key: 'objectKb', label: 'Object size (KB)', step: 0.5 },
  { key: 'retentionYears', label: 'Retention (years)' },
  { key: 'replication', label: 'Replication factor' },
];

/** Back-of-the-envelope calculator: users → QPS, storage and bandwidth. */
export function EstimatorPanel() {
  const [input, setInput] = useState<EstimateInput>(DEFAULT_ESTIMATE);
  const r = estimate(input);
  const apply = () => {
    useDesignStore
      .getState()
      .setTraffic({ peakRps: Math.round(r.peakRps), readRatio: r.readRatio });
    useUiStore
      .getState()
      .showToast(
        `Traffic set to ${formatCompact(r.peakRps)} req/s peak, ${formatPct(r.readRatio, 0)} reads`,
      );
  };
  return (
    <div className="panel-pad">
      <Section title="Assumptions">
        <div className="field-grid">
          {INPUTS.map((f) => (
            <Field key={f.key} label={f.label}>
              <NumberInput
                value={input[f.key]}
                min={0}
                step={f.step}
                onChange={(v) => setInput({ ...input, [f.key]: v })}
              />
            </Field>
          ))}
        </div>
      </Section>
      <Section title="Estimate">
        <div className="stat-grid">
          <Stat label="Average load" value={`${formatCompact(r.avgRps)} req/s`} />
          <Stat label="Peak load" value={`${formatCompact(r.peakRps)} req/s`} tone="warn" />
          <Stat label="Reads" value={`${formatCompact(r.readRps)} req/s`} />
          <Stat label="Writes" value={`${formatCompact(r.writeRps)} req/s`} />
          <Stat label="New data / day" value={formatBytes(r.storagePerDayBytes)} />
          <Stat label="Total storage" value={formatBytes(r.totalStorageBytes)} />
          <Stat label="Egress (avg)" value={`${formatBytes(r.egressBytesPerSec)}/s`} />
          <Stat label="Egress (peak)" value={`${formatBytes(r.peakEgressBytesPerSec)}/s`} />
        </div>
        <p className="muted small mono">
          QPS = DAU × req/day ÷ 86,400 · storage = writes/day × size × 365 × years × copies
        </p>
        <Button variant="primary" onClick={apply}>
          Use as traffic
        </Button>
      </Section>
    </div>
  );
}
