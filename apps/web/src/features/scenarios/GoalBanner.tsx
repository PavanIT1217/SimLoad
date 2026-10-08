import { describeGoal } from '@syssim/engine';
import { useState } from 'react';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';
import { formatMs, formatPct, formatUsd } from '../../ui/format';
import { findScenario } from './index';
import { loadScenario } from './loadScenario';
import './scenarios.css';

export function GoalBanner() {
  const scenario = findScenario(useUiStore((s) => s.scenarioId));
  const mode = useUiStore((s) => s.mode);
  const status = useSimStore((s) => s.goal);
  const [showHints, setShowHints] = useState(false);
  if (!scenario || mode !== 'prep') return null;
  const state = status?.state ?? 'pending';

  return (
    <div className={`goal-banner goal-${state}`} role="status">
      <div className="goal-main">
        <strong>{scenario.name}</strong>
        <span className="goal-text">{describeGoal(scenario.goal)}</span>
        <span className={`goal-pill pill-${state}`}>
          {state === 'pass' ? '✓ PASS' : state === 'fail' ? '✗ FAIL' : 'Pending'}
        </span>
        {status && state === 'pending' && status.progress > 0 && (
          <span className="goal-progress" aria-label="Evaluation progress">
            <span style={{ width: `${Math.round(status.progress * 100)}%` }} />
          </span>
        )}
        <span className="goal-checks mono">
          {status?.checks.map((c) => (
            <span key={c.label} className={c.ok ? 'is-ok' : 'is-bad'}>
              {c.label.startsWith('p99')
                ? `p99 ${formatMs(c.actual)}`
                : c.label.startsWith('Monthly')
                  ? `${formatUsd(c.actual)}/mo`
                  : `err ${formatPct(c.actual, 2)}`}
            </span>
          ))}
        </span>
        <span className="goal-message muted">{status?.message}</span>
        <span className="goal-actions">
          <Button size="sm" variant="ghost" onClick={() => setShowHints((v) => !v)}>
            {showHints ? 'Hide hints' : 'Hints'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => loadScenario(scenario.id)}>
            Restart scenario
          </Button>
        </span>
      </div>
      {showHints && (
        <div className="goal-details">
          <p>{scenario.summary}</p>
          <ul>
            {scenario.hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
