import { perInstanceCapacity } from '@simload/engine';
import type { AutoscaleConfig, CircuitBreakerConfig, DesignNode } from '@simload/engine';
import { useDesignStore } from '../../state/designStore';
import { Field, NumberInput, Toggle } from '../../ui/Field';
import { formatRps } from '../../ui/format';
import { Section } from '../../ui/Section';
import type { FieldGroup } from './fields';
import { GROUP_LABELS, fieldsFor, supportsAutoscale } from './fields';

const GROUPS: readonly FieldGroup[] = ['capacity', 'latency', 'resilience', 'cost'];

function BreakerFields({ node }: { node: DesignNode }) {
  const updateNodeConfig = useDesignStore((s) => s.updateNodeConfig);
  const cb = node.config.circuitBreaker;
  const set = (patch: Partial<CircuitBreakerConfig>) =>
    updateNodeConfig(node.id, { circuitBreaker: { ...cb, ...patch } });
  return (
    <>
      <Toggle
        label="Circuit breaker"
        checked={cb.enabled}
        onChange={(enabled) => set({ enabled })}
      />
      {cb.enabled && (
        <div className="field-grid">
          <Field label="Trip at error rate (%)" hint="Opens when this share of calls fails">
            <NumberInput
              value={cb.errorThreshold}
              scale={100}
              min={0.01}
              max={1}
              onChange={(errorThreshold) => set({ errorThreshold })}
            />
          </Field>
          <Field label="Open for (ms)" hint="Then lets 10% probe traffic through">
            <NumberInput value={cb.openMs} min={100} onChange={(openMs) => set({ openMs })} />
          </Field>
        </div>
      )}
    </>
  );
}

/** Node configuration, grouped like an instrument panel. */
export function ConfigSections({ node }: { node: DesignNode }) {
  const updateNodeConfig = useDesignStore((s) => s.updateNodeConfig);
  const updateNode = useDesignStore((s) => s.updateNode);
  const fields = fieldsFor(node.kind);
  return (
    <>
      {GROUPS.map((group) => {
        const groupFields = fields.filter((f) => f.group === group);
        const showBreaker = group === 'resilience' && node.kind !== 'client';
        if (groupFields.length === 0 && !showBreaker) return null;
        return (
          <Section key={group} title={GROUP_LABELS[group]}>
            <div className="field-grid">
              {groupFields.map((f) => (
                <Field key={f.key} label={f.label} hint={f.hint}>
                  <NumberInput
                    value={node.config[f.key]}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    scale={f.scale}
                    ariaLabel={f.label}
                    onChange={(v) => updateNodeConfig(node.id, { [f.key]: v })}
                  />
                </Field>
              ))}
              {group === 'resilience' && node.kind !== 'client' && (
                <Field label="Zone" hint="Availability zone / region, for zone-outage chaos">
                  <input
                    className="input mono"
                    value={node.zone ?? ''}
                    placeholder="e.g. us-east-1a"
                    onChange={(e) => updateNode(node.id, { zone: e.target.value || undefined })}
                  />
                </Field>
              )}
            </div>
            {group === 'capacity' && node.kind !== 'client' && node.kind !== 'queue' && (
              <p className="muted small">
                Effective capacity: {formatRps(perInstanceCapacity(node.config))} per instance (the
                lower of capacity and pool size ÷ latency).
              </p>
            )}
            {showBreaker && <BreakerFields node={node} />}
          </Section>
        );
      })}
    </>
  );
}

export function AutoscaleSection({ node }: { node: DesignNode }) {
  const updateNodeConfig = useDesignStore((s) => s.updateNodeConfig);
  if (!supportsAutoscale(node.kind)) return null;
  const autoscale = node.config.autoscale;
  const set = (patch: Partial<AutoscaleConfig>) =>
    updateNodeConfig(node.id, { autoscale: { ...autoscale, ...patch } });
  return (
    <Section title="Autoscaling">
      <Toggle
        label="Autoscale on load"
        checked={autoscale.enabled}
        onChange={(enabled) => set({ enabled })}
      />
      {autoscale.enabled && (
        <div className="field-grid">
          <Field label="Boot delay (s)" hint="Time before new instances take traffic">
            <NumberInput
              value={autoscale.delayMs}
              scale={0.001}
              min={0}
              onChange={(delayMs) => set({ delayMs })}
            />
          </Field>
          <Field label="Target utilization (%)">
            <NumberInput
              value={autoscale.targetUtilization}
              scale={100}
              min={0.05}
              max={1}
              onChange={(targetUtilization) => set({ targetUtilization })}
            />
          </Field>
          <Field label="Min instances">
            <NumberInput
              value={autoscale.minInstances}
              min={1}
              onChange={(minInstances) => set({ minInstances })}
            />
          </Field>
          <Field label="Max instances">
            <NumberInput
              value={autoscale.maxInstances}
              min={1}
              onChange={(maxInstances) => set({ maxInstances })}
            />
          </Field>
        </div>
      )}
    </Section>
  );
}
