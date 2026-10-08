import { KIND_LABELS } from '@syssim/engine';
import type { ComponentKind } from '@syssim/engine';
import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { useDesignStore } from '../../state/designStore';
import { formatCompact, formatMs } from '../../ui/format';
import { HEALTH_LABEL, healthOf } from '../../ui/health';
import { KindIcon } from '../../ui/KindIcon';
import { Gauge } from './Gauge';
import { useNodeView } from './useNodeView';

export type SystemNodeData = Record<string, never>;
export type SystemFlowNode = Node<SystemNodeData, 'system'>;

/** Short instrument-style designators shown on each node. */
const KIND_CODE: Record<ComponentKind, string> = {
  client: 'SRC',
  cdn: 'CDN',
  loadBalancer: 'LB',
  service: 'SVC',
  cache: 'MEM',
  queue: 'MQ',
  database: 'DB',
  externalApi: 'EXT',
};

function SystemNodeView({ id, selected }: NodeProps<SystemFlowNode>) {
  const node = useDesignStore((s) => s.design.nodes.find((n) => n.id === id));
  const live = useNodeView(id);
  if (!node) return null;

  const health = live ? healthOf(live.saturation, live.queueDepth, live.failed) : 'idle';
  const isClient = node.kind === 'client';
  const instances = live?.instances ?? node.config.instances;

  return (
    <div
      className={`sys-node health-${health} ${selected ? 'is-selected' : ''}`}
      aria-label={`${node.label}: ${HEALTH_LABEL[health]}`}
    >
      {!isClient && <Handle type="target" position={Position.Left} />}
      <header className="sys-node-header">
        <span className="sys-node-icon">
          <KindIcon kind={node.kind} size={15} />
        </span>
        <span className="sys-node-titles">
          <span className="sys-node-label">{node.label}</span>
          <span className="sys-node-kind mono">
            {KIND_CODE[node.kind]}
            {!isClient && ` ×${instances}`}
            {node.kind === 'database' && node.config.replicas > 0 && ` +${node.config.replicas}R`}
            <span className="sr-only"> {KIND_LABELS[node.kind]}</span>
          </span>
        </span>
        {!isClient && <Gauge value={live?.saturation ?? 0} />}
      </header>
      <dl className="sys-node-stats mono">
        <div>
          <dt>λ</dt>
          <dd>{formatCompact(live?.inflowRps ?? 0)}/s</dd>
        </div>
        {isClient ? (
          <div>
            <dt>ok</dt>
            <dd>{live ? `${(live.successRate * 100).toFixed(1)}%` : '–'}</dd>
          </div>
        ) : (
          <>
            <div className={(live?.queueDepth ?? 0) > 1 ? 'is-hot' : ''}>
              <dt>Q</dt>
              <dd>{formatCompact(live?.queueDepth ?? 0)}</dd>
            </div>
            <div>
              <dt>W</dt>
              <dd>{formatMs(live?.latencyMs ?? 0)}</dd>
            </div>
          </>
        )}
      </dl>
      {live?.failed && <div className="sys-node-badge">OFFLINE</div>}
      {!live?.failed && (live?.faults.length ?? 0) > 0 && (
        <div className="sys-node-badge is-warn">{live?.faults.join(' · ')}</div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const SystemNode = memo(SystemNodeView);
