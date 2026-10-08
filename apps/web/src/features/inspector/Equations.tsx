import type { NodeTickState } from '@simload/engine';
import { formatCompact, formatMs } from '../../ui/format';

export interface EquationsProps {
  live: NodeTickState;
}

/**
 * The queueing quantities behind a node's numbers, evaluated live:
 * load factor ρ = λ/μ, Little's Law L = λW, and the latency split W = Wₛ + W_q.
 */
export function Equations({ live }: EquationsProps) {
  const rho = live.capacityRps > 0 ? live.inflowRps / live.capacityRps : 0;
  const inSystem = live.servedRps * (live.latencyMs / 1000);
  return (
    <div className="equations mono" aria-label="Queueing equations">
      <div className="equation">
        <span className="eq-lhs">ρ</span>
        <span className="eq-op">=</span>
        <span className="eq-rhs">
          λ / μ = {formatCompact(live.inflowRps)} / {formatCompact(live.capacityRps)}
        </span>
        <span className={`eq-result ${rho >= 1 ? 'is-bad' : rho >= 0.7 ? 'is-warn' : ''}`}>
          {rho.toFixed(2)}
        </span>
      </div>
      <div className="equation">
        <span className="eq-lhs">L</span>
        <span className="eq-op">=</span>
        <span className="eq-rhs">
          λ·W = {formatCompact(live.servedRps)} × {formatMs(live.latencyMs)}
        </span>
        <span className="eq-result">{formatCompact(inSystem)}</span>
      </div>
      <div className="equation">
        <span className="eq-lhs">W</span>
        <span className="eq-op">=</span>
        <span className="eq-rhs">Wₛ + W_q (+ injected)</span>
        <span className="eq-result">{formatMs(live.latencyMs)}</span>
      </div>
      <div className="equation">
        <span className="eq-lhs">Q</span>
        <span className="eq-op">=</span>
        <span className="eq-rhs">backlog, drops beyond max queue</span>
        <span className={`eq-result ${live.queueDepth > 1 ? 'is-bad' : ''}`}>
          {formatCompact(live.queueDepth)}
        </span>
      </div>
    </div>
  );
}
