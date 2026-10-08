import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { Edge, EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import { useSimStore } from '../../state/simStore';
import { formatCompact } from '../../ui/format';
import { strokeWidthFor } from './edgeStyle';

export type FlowEdgeData = { weight: number };
export type SystemFlowEdge = Edge<FlowEdgeData, 'flow'>;

function FlowEdgeView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps<SystemFlowEdge>) {
  const rps = useSimStore((s) => s.latest?.edges[id] ?? 0);
  const running = useSimStore((s) => s.running);
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const active = rps > 0;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={`flow-edge ${active && running ? 'is-flowing' : ''} ${selected ? 'is-selected' : ''}`}
        style={{ strokeWidth: active ? strokeWidthFor(rps) : 1.5 }}
      />
      <EdgeLabelRenderer>
        <div
          className={`flow-edge-label mono ${selected ? 'is-selected' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {active ? formatCompact(rps) : '0'}
          {data && data.weight !== 1 && <span className="flow-edge-weight">w{data.weight}</span>}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const FlowEdge = memo(FlowEdgeView);
