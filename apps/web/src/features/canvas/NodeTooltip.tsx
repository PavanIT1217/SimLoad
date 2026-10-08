import { KIND_LABELS, perInstanceCapacity } from '@simload/engine';
import type { DesignNode } from '@simload/engine';
import { formatMs, formatRps } from '../../ui/format';

/** Hover card for a canvas node: what it is for, plus its key settings. */
export function NodeTooltip({ node }: { node: DesignNode }) {
  const cfg = node.config;
  const isClient = node.kind === 'client';
  return (
    <div className="node-tooltip" role="tooltip">
      <div className="node-tooltip-head">
        <strong>{node.label}</strong>
        <span className="mono">{KIND_LABELS[node.kind]}</span>
      </div>
      {node.description ? (
        <p className="node-tooltip-text">{node.description}</p>
      ) : (
        <p className="node-tooltip-text is-empty">
          No description yet. Select the node and add one in the inspector.
        </p>
      )}
      {!isClient && (
        <dl className="node-tooltip-facts mono">
          <dt>Capacity</dt>
          <dd>
            {formatRps(perInstanceCapacity(cfg))} × {cfg.instances}
          </dd>
          <dt>Latency</dt>
          <dd>{formatMs(cfg.baseLatencyMs)} median</dd>
          {node.zone && (
            <>
              <dt>Zone</dt>
              <dd>{node.zone}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
