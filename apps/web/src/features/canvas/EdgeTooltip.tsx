import { formatRps } from '../../ui/format';
import type { FlowEdgeData } from './FlowEdge';

const CARRIES: Record<FlowEdgeData['traffic'], string> = {
  all: 'All requests',
  read: 'Reads only',
  write: 'Writes only',
};

/** Hover card for a connection: its purpose, what it carries and its live flow. */
export function EdgeTooltip({ data, rps }: { data: FlowEdgeData | undefined; rps: number }) {
  return (
    <div className="edge-tooltip" role="tooltip">
      {data?.description ? (
        <p className="node-tooltip-text">{data.description}</p>
      ) : (
        <p className="node-tooltip-text is-empty">
          No description yet. Select the connection to add one.
        </p>
      )}
      <dl className="node-tooltip-facts mono">
        <dt>Carries</dt>
        <dd>{CARRIES[data?.traffic ?? 'all']}</dd>
        <dt>Flow</dt>
        <dd>{formatRps(rps)}</dd>
      </dl>
    </div>
  );
}
