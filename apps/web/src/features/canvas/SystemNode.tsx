import { KIND_LABELS } from '@syssim/engine';
import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import { formatCompact, formatMs, formatRps } from '../../ui/format';
import { HEALTH_LABEL, healthOf } from '../../ui/health';
import { KindIcon } from '../../ui/KindIcon';

export type SystemNodeData = Record<string, never>;
export type SystemFlowNode = Node<SystemNodeData, 'system'>;

function SystemNodeView({ id, selected }: NodeProps<SystemFlowNode>) {
  const node = useDesignStore((s) => s.design.nodes.find((n) => n.id === id));
  const live = useSimStore((s) => s.latest?.nodes[id]);
  if (!node) return null;

  const health = live ? healthOf(live.saturation, live.queueDepth, live.failed) : 'idle';
  const isClient = node.kind === 'client';
  const utilPct = Math.min(100, Math.round((live?.saturation ?? 0) * 100));

  return (
    <div
      className={`sys-node health-${health} ${selected ? 'is-selected' : ''}`}
      aria-label={`${node.label}: ${HEALTH_LABEL[health]}`}
    >
      {!isClient && <Handle type="target" position={Position.Left} />}
      <header className="sys-node-header">
        <span className={`sys-node-icon kind-${node.kind}`}>
          <KindIcon kind={node.kind} size={16} />
        </span>
        <span className="sys-node-titles">
          <span className="sys-node-label">{node.label}</span>
          <span className="sys-node-kind">
            {KIND_LABELS[node.kind]}
            {!isClient && ` · ×${live?.instances ?? node.config.instances}`}
            {node.kind === 'database' && node.config.replicas > 0 && ` +${node.config.replicas}r`}
          </span>
        </span>
      </header>
      <div className="sys-node-stats mono">
        <span title="Inflow">{formatRps(live?.inflowRps ?? 0)}</span>
        {!isClient && (
          <span title="Queue depth" className={(live?.queueDepth ?? 0) > 1 ? 'is-hot' : ''}>
            Q {formatCompact(live?.queueDepth ?? 0)}
          </span>
        )}
        {!isClient && <span title="Latency at this node">{formatMs(live?.latencyMs ?? 0)}</span>}
        {isClient && live && (
          <span title="End-to-end success">{((live.successRate ?? 0) * 100).toFixed(1)}% ok</span>
        )}
      </div>
      {!isClient && (
        <div className="sys-node-meter" title={`Utilization ${utilPct}%`}>
          <span style={{ width: `${utilPct}%` }} />
        </div>
      )}
      {live?.failed && <div className="sys-node-badge">DOWN</div>}
      {!live?.failed && (live?.faults.length ?? 0) > 0 && (
        <div className="sys-node-badge is-warn">{live?.faults.join(', ')}</div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const SystemNode = memo(SystemNodeView);
