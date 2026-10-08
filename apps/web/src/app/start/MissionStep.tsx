import { describeGoal } from '@simload/engine';
import { useEffect, useRef } from 'react';
import type { StartupInfo } from '../../features/persistence/bootstrap';
import { findScenario } from '../../features/scenarios';
import { useDesignStore } from '../../state/designStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';

export interface MissionStepProps {
  startup: StartupInfo;
  onBack: (() => void) | null;
  onLaunch(): void;
  onExplore(): void;
  onRestore(): void;
}

/** Step 2: the loaded scenario, its goal, and a prediction to make before launch. */
export function MissionStep({ startup, onBack, onLaunch, onExplore, onRestore }: MissionStepProps) {
  const design = useDesignStore((s) => s.design);
  const scenarioId = useUiStore((s) => s.scenarioId);
  const prediction = useUiStore((s) => s.prediction);
  const setPrediction = useUiStore((s) => s.setPrediction);
  const launch = useRef<HTMLButtonElement>(null);
  useEffect(() => launch.current?.focus(), []);

  const scenario = startup.kind === 'scenario' ? findScenario(scenarioId) : undefined;
  const candidates = design.nodes.filter((n) => n.kind !== 'client');

  return (
    <>
      <p className="start-kicker mono">
        {startup.kind === 'shared' ? 'Shared design loaded' : 'Mission briefing'}
      </p>
      <h2 id="start-title" className="start-title">
        {startup.title}
      </h2>
      {startup.detail && <p className="start-lead">{startup.detail}</p>}
      {scenario && (
        <div className="start-objective">
          <span className="mono">Objective</span>
          <p>{describeGoal(scenario.goal)}.</p>
        </div>
      )}
      {candidates.length > 1 && (
        <fieldset className="start-predict">
          <legend>
            Before you launch: <strong>which component cracks first?</strong>
          </legend>
          <div className="start-chips" role="radiogroup">
            {candidates.map((n) => (
              <button
                key={n.id}
                type="button"
                role="radio"
                aria-checked={prediction === n.id}
                className={`start-chip mono ${prediction === n.id ? 'is-picked' : ''}`}
                onClick={() => setPrediction(prediction === n.id ? null : n.id)}
              >
                {n.label}
              </button>
            ))}
          </div>
          <p className="start-predict-hint">
            {prediction
              ? 'Locked in. We will tell you if you were right.'
              : 'Optional. Pick one and we will tell you if you were right.'}
          </p>
        </fieldset>
      )}
      <div className="start-actions">
        <Button ref={launch} variant="primary" onClick={onLaunch}>
          ▶ Launch simulation
        </Button>
        <Button variant="ghost" onClick={onExplore}>
          Explore first
        </Button>
        {startup.previous && (
          <Button variant="ghost" onClick={onRestore} title={startup.previous.design.name}>
            Restore my last design
          </Button>
        )}
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            ← Back
          </Button>
        )}
      </div>
    </>
  );
}
