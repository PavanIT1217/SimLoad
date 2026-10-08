import { KIND_LABELS, perInstanceCapacity } from '@syssim/engine';
import type { AutoscaleConfig, DesignNode } from '@syssim/engine';
import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';
import { Field, NumberInput, Toggle } from '../../ui/Field';
import { formatCompact, formatMs, formatPct, formatRps } from '../../ui/format';
import { HEALTH_LABEL, healthOf } from '../../ui/health';
import { KindIcon } from '../../ui/KindIcon';
import { Section, Stat } from '../../ui/Section';
import { CalibrationPanel } from './CalibrationPanel';
import { ChaosActions } from './ChaosActions';
import { fieldsFor, supportsAutoscale } from './fields';

export interface NodeInspectorProps {
  node: DesignNode;
}

function LiveStats({ nodeId }: { nodeId: string }) {
  const live = useSimStore((s) => s.latest?.nodes[nodeId]);
  if (!live) return <p className="muted small">Run the simulation to see live metrics.</p>;
  const health = healthOf(live.saturation, live.queueDepth, live.failed);
  const tone =
    health === 'ok' ? 'ok' : health === 'warn' ? 'warn' : health === 'idle' ? 'muted' : 'bad';
  return (
    <div className="stat-grid">
      <Stat label="Status" value={HEALTH_LABEL[health]} tone={tone} />
      <Stat label="Inflow" value={formatRps(live.inflowRps)} />
      <Stat
        label="Reads / writes"
        value={`${formatCompact(live.readRps)} / ${formatCompact(live.writeRps)}`}
      />
      <Stat label="Capacity" value={formatRps(live.capacityRps)} />
      <Stat label="Utilization" value={formatPct(live.saturation, 0)} tone={tone} />
      <Stat label="Queue depth" value={formatCompact(live.queueDepth)} />
      <Stat label="Local latency" value={formatMs(live.latencyMs)} />
      <Stat label="End-to-end" value={formatMs(live.e2eLatencyMs)} />
      <Stat
        label="Dropped"
        value={formatRps(live.droppedRps)}
        tone={live.droppedRps > 0 ? 'bad' : undefined}
      />
      <Stat
        label="Errors"
        value={formatPct(1 - live.successRate, 2)}
        tone={live.successRate < 0.999 ? 'bad' : undefined}
      />
      <Stat
        label="Retries"
        value={formatRps(live.retryRps)}
        tone={live.retryRps > 0 ? 'warn' : undefined}
      />
      <Stat label="Instances" value={live.instances} />
    </div>
  );
}

export function NodeInspector({ node }: NodeInspectorProps) {
  const updateNode = useDesignStore((s) => s.updateNode);
  const updateNodeConfig = useDesignStore((s) => s.updateNodeConfig);
  const removeNode = useDesignStore((s) => s.removeNode);
  const mode = useUiStore((s) => s.mode);
  const live = useSimStore((s) => s.latest?.nodes[node.id]);
  const autoscale = node.config.autoscale;
  const setAutoscale = (patch: Partial<AutoscaleConfig>) =>
    updateNodeConfig(node.id, { autoscale: { ...autoscale, ...patch } });

  return (
    <div className="inspector-content">
      <header className="inspector-header">
        <span className="inspector-icon">
          <KindIcon kind={node.kind} size={20} />
        </span>
        <div className="inspector-titles">
          <input
            className="input inspector-name"
            value={node.label}
            aria-label="Node name"
            onChange={(e) => updateNode(node.id, { label: e.target.value })}
          />
          <span className="muted small">
            {KIND_LABELS[node.kind]} · <span className="mono">{node.id}</span>
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => removeNode(node.id)} title="Delete node">
          Delete
        </Button>
      </header>

      <Section title="Live">
        <LiveStats nodeId={node.id} />
      </Section>

      {node.kind !== 'client' && <ChaosActions node={node} live={live} />}

      {mode === 'validation' && <CalibrationPanel key={node.id} node={node} />}

      <Section title="Configuration">
        <div className="field-grid">
          {fieldsFor(node.kind).map((f) => (
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
        </div>
        {node.kind !== 'client' && node.kind !== 'queue' && (
          <p className="muted small">
            Effective capacity: {formatRps(perInstanceCapacity(node.config))} per instance (the
            lower of capacity and pool size ÷ latency).
          </p>
        )}
      </Section>

      {supportsAutoscale(node.kind) && (
        <Section title="Autoscaling">
          <Toggle
            label="Autoscale on load"
            checked={autoscale.enabled}
            onChange={(enabled) => setAutoscale({ enabled })}
          />
          {autoscale.enabled && (
            <div className="field-grid">
              <Field label="Boot delay (s)" hint="Time before new instances take traffic">
                <NumberInput
                  value={autoscale.delayMs}
                  scale={0.001}
                  min={0}
                  onChange={(delayMs) => setAutoscale({ delayMs })}
                />
              </Field>
              <Field label="Target utilization (%)">
                <NumberInput
                  value={autoscale.targetUtilization}
                  scale={100}
                  min={0.05}
                  max={1}
                  onChange={(targetUtilization) => setAutoscale({ targetUtilization })}
                />
              </Field>
              <Field label="Min instances">
                <NumberInput
                  value={autoscale.minInstances}
                  min={1}
                  onChange={(minInstances) => setAutoscale({ minInstances })}
                />
              </Field>
              <Field label="Max instances">
                <NumberInput
                  value={autoscale.maxInstances}
                  min={1}
                  onChange={(maxInstances) => setAutoscale({ maxInstances })}
                />
              </Field>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
