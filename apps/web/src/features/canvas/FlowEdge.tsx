import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeTraffic } from '@syssim/engine';
import type { Edge, EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import { useSimStore } from '../../state/simStore';
import { formatCompact } from '../../ui/format';
import { particleCount, particleDuration, strokeWidthFor } from './edgeStyle';

export type FlowEdgeData = { weight: number; traffic: EdgeTraffic };
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
  const active = rps > 0.5;
  const particles = running && active ? particleCount(rps) : 0;
  // Quantised, so the SMIL animation is not restarted on every small change in flow.
  const duration = particleDuration(rps);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={`flow-edge ${active ? 'is-active' : ''} ${selected ? 'is-selected' : ''}`}
        style={{ strokeWidth: active ? strokeWidthFor(rps) : 1.25 }}
      />
      {Array.from({ length: particles }, (_, i) => (
        <circle key={i} className="flow-particle" r={2.2}>
          <animateMotion
            dur={`${duration}s`}
            repeatCount="indefinite"
            path={path}
            begin={`${(-duration * i) / particles}s`}
          />
        </circle>
      ))}
      <EdgeLabelRenderer>
        <div
          className={`flow-edge-label mono ${selected ? 'is-selected' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {active ? formatCompact(rps) : '0'}
          {data && data.traffic !== 'all' && (
            <span className={`flow-edge-class is-${data.traffic}`} title={`${data.traffic}s only`}>
              {data.traffic === 'read' ? 'R' : 'W'}
            </span>
          )}
          {data && data.weight !== 1 && <span className="flow-edge-weight">w{data.weight}</span>}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const FlowEdge = memo(FlowEdgeView);
