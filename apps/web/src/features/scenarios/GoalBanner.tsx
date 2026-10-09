import { describeGoal } from '@simload/engine';
import type { GoalStatus } from '@simload/engine';
import { useState } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';
import { formatMs, formatPct, formatUsd } from '../../ui/format';
import { findScenario } from './index';
import { loadScenario } from './loadScenario';
import type { Scenario } from './types';
import './scenarios.css';

function checkText(c: GoalStatus['checks'][number]): string {
  if (c.label.startsWith('p99')) return `p99 ${formatMs(c.actual)}`;
  if (c.label.startsWith('Monthly')) return `${formatUsd(c.actual)}/mo`;
  return `err ${formatPct(c.actual, 2)}`;
}

function ScenarioBanner({ scenario }: { scenario: Scenario }) {
  const status = useSimStore((s) => s.goal);
  const state = status?.state ?? 'pending';
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(1);
  // Each newly failed attempt unlocks the next hint.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state === 'fail') setRevealed((r) => Math.min(scenario.hints.length, r + 1));
  }

  const showSolution = () => {
    if (!window.confirm('Replace your design with the reference solution?')) return;
    useDesignStore.getState().setDesign(scenario.solution());
    useUiStore.getState().showToast('Reference solution loaded: run it to see the goal pass');
  };

  return (
    <div className={`goal-banner goal-${state}`} role="status">
      <div className="goal-main">
        <strong>{scenario.name}</strong>
        <span className={`difficulty diff-${scenario.difficulty}`}>{scenario.difficulty}</span>
        <span className="goal-text">{describeGoal(scenario.goal)}</span>
        <span className={`goal-pill pill-${state}`}>
          {state === 'pass' ? '✓ PASS' : state === 'fail' ? '✗ FAIL' : 'Pending'}
        </span>
        {status && state === 'pending' && status.progress > 0 && (
          <span className="goal-progress" aria-label="Evaluation progress">
            <span style={{ width: `${Math.round(status.progress * 100)}%` }} />
          </span>
        )}
        {/* Live numbers are in the telemetry strip; show per-check results once judged. */}
        {state !== 'pending' && (
          <span className="goal-checks mono">
            {status?.checks.map((c) => (
              <span key={c.label} className={c.ok ? 'is-ok' : 'is-bad'}>
                {checkText(c)}
              </span>
            ))}
          </span>
        )}
        <span className="goal-message muted">{status?.message}</span>
        <span className="goal-actions">
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Hide brief' : `Brief & hints ${revealed}/${scenario.hints.length}`}
          </Button>
        </span>
      </div>
      {open && (
        <div className="goal-details">
          <p>{scenario.summary}</p>
          {scenario.chaos?.map((c) => (
            <p key={c.label} className="goal-chaos mono">
              ⚡ Scripted chaos: {c.label} at T+{c.atS}s for {c.durationS}s
            </p>
          ))}
          <ol className="goal-hints">
            {scenario.hints.slice(0, revealed).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ol>
          <div className="goal-hint-actions">
            {revealed < scenario.hints.length && (
              <Button size="sm" onClick={() => setRevealed((r) => r + 1)}>
                Next hint
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => loadScenario(scenario.id)}>
              Restart scenario
            </Button>
            <Button size="sm" variant="ghost" onClick={showSolution}>
              Load reference solution
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function GoalBanner() {
  const scenario = findScenario(useUiStore((s) => s.scenarioId));
  const mode = useUiStore((s) => s.mode);
  if (!scenario || mode !== 'prep') return null;
  return <ScenarioBanner key={scenario.id} scenario={scenario} />;
}
