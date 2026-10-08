import { KIND_LABELS } from '@syssim/engine';
import type { DesignNode } from '@syssim/engine';
import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';
import { formatCompact, formatMs, formatPct, formatRps } from '../../ui/format';
import { HEALTH_LABEL, healthOf } from '../../ui/health';
import { KindIcon } from '../../ui/KindIcon';
import { Section, Stat } from '../../ui/Section';
import { CalibrationPanel } from './CalibrationPanel';
import { ChaosActions } from './ChaosActions';
import { Equations } from './Equations';
import { AutoscaleSection, ConfigSections } from './ConfigSections';

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
    <>
      {live.kind !== 'client' && <Equations live={live} />}
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
        {live.shedRps > 0 && (
          <Stat label="Shed (rate limit)" value={formatRps(live.shedRps)} tone="warn" />
        )}
        {live.breaker !== 'closed' && (
          <Stat
            label="Circuit breaker"
            value={live.breaker === 'open' ? 'Open' : 'Half-open'}
            tone="bad"
          />
        )}
        {live.coldFraction > 0 && (
          <Stat label="Cold instances" value={formatPct(live.coldFraction, 0)} tone="warn" />
        )}
      </div>
    </>
  );
}

export function NodeInspector({ node }: NodeInspectorProps) {
  const updateNode = useDesignStore((s) => s.updateNode);
  const removeNode = useDesignStore((s) => s.removeNode);
  const mode = useUiStore((s) => s.mode);
  const live = useSimStore((s) => s.latest?.nodes[node.id]);

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

      <ConfigSections node={node} />
      <AutoscaleSection node={node} />
    </div>
  );
}
