import type { PlanChange, PlanEvaluation, ScenarioGoal } from '@syssim/engine';
import { useState } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';
import { Field, NumberInput } from '../../ui/Field';
import { formatCompact, formatMs, formatPct, formatUsd } from '../../ui/format';
import { Section } from '../../ui/Section';
import { findScenario } from '../scenarios';
import { usePlanner } from './usePlanner';
import './planner.css';

const FIELD_LABEL: Record<PlanChange['field'], string> = {
  instances: 'instances',
  replicas: 'read replicas',
  shards: 'shards',
  consumerRps: 'consumer msg/s',
};

function Evaluation({ title, e }: { title: string; e: PlanEvaluation }) {
  return (
    <div className={`plan-eval ${e.pass ? 'is-pass' : 'is-fail'}`}>
      <span className="plan-eval-title">{title}</span>
      <span className="mono">p99 {formatMs(e.p99)}</span>
      <span className="mono">err {formatPct(e.errorRate, 2)}</span>
      <span className="mono">{formatUsd(e.monthlyCost)}/mo</span>
    </div>
  );
}

/** Capacity planner: searches for the leanest configuration that meets a goal. */
export function PlannerPanel() {
  const design = useDesignStore((s) => s.design);
  const scenarioGoal = findScenario(useUiStore((s) => s.scenarioId))?.goal;
  const [goal, setGoal] = useState<ScenarioGoal>(
    () =>
      scenarioGoal ?? {
        targetRps: design.traffic.peakRps,
        maxP99Ms: 200,
        maxErrorRate: 0.001,
        holdSeconds: 5,
      },
  );
  const { state, start, stop } = usePlanner();
  const result = state.result;

  const apply = () => {
    if (!result) return;
    const store = useDesignStore.getState();
    for (const c of result.changes) store.updateNodeConfig(c.nodeId, { [c.field]: c.to });
    useUiStore.getState().showToast(`Applied ${result.changes.length} change(s) from the planner`);
  };

  return (
    <div className="panel-pad">
      <Section title="Goal">
        <div className="field-grid">
          <Field label="Target load (req/s)">
            <NumberInput
              value={goal.targetRps}
              min={1}
              onChange={(targetRps) => setGoal({ ...goal, targetRps })}
            />
          </Field>
          <Field label="Max p99 (ms)">
            <NumberInput
              value={goal.maxP99Ms}
              min={1}
              onChange={(maxP99Ms) => setGoal({ ...goal, maxP99Ms })}
            />
          </Field>
          <Field label="Max error rate (%)">
            <NumberInput
              value={goal.maxErrorRate}
              scale={100}
              min={0}
              max={1}
              step={0.01}
              onChange={(maxErrorRate) => setGoal({ ...goal, maxErrorRate })}
            />
          </Field>
          {scenarioGoal && (
            <Button size="sm" variant="ghost" onClick={() => setGoal(scenarioGoal)}>
              Use scenario goal
            </Button>
          )}
        </div>
        <div className="plan-actions">
          {state.running ? (
            <Button variant="danger" onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button variant="primary" onClick={() => start(design, goal)}>
              Find capacity
            </Button>
          )}
          <span className="muted small">
            Grows the bottleneck until the goal holds at {formatCompact(goal.targetRps)} req/s with
            ≥10% headroom, then trims back.
          </span>
        </div>
      </Section>

      {(state.running || state.latest) && !result && (
        <Section title="Searching">
          <div className="plan-progress mono" role="status">
            <span className="plan-spinner" aria-hidden="true" />
            {state.phase ?? 'grow'} · run {state.evaluations}
            {state.latest &&
              ` · p99 ${formatMs(state.latest.p99)} · ρmax ${state.latest.bottleneckRho.toFixed(2)}`}
          </div>
        </Section>
      )}

      {state.error && <p className="muted small">Planner failed: {state.error}</p>}

      {result && (
        <Section title={result.status === 'unreachable' ? 'No plan found' : 'Plan'}>
          <p className="small">{result.message}</p>
          <Evaluation title="Before" e={result.before} />
          <Evaluation title="After" e={result.after} />
          {result.changes.length > 0 && (
            <ul className="plan-changes">
              {result.changes.map((c) => (
                <li key={`${c.nodeId}:${c.field}`}>
                  <strong>{c.label}</strong> {FIELD_LABEL[c.field]}{' '}
                  <span className="mono">
                    {formatCompact(c.from)} → <span className="plan-to">{formatCompact(c.to)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {result.status === 'met' && (
            <Button variant="primary" onClick={apply}>
              Apply plan to design
            </Button>
          )}
        </Section>
      )}
    </div>
  );
}
