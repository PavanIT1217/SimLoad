import { describeGoal } from '@simload/engine';
import { useEffect, useRef } from 'react';
import { findScenario } from '../../features/scenarios';
import { simulation } from '../../features/simulation/client';
import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';
import { setIntroSeen } from './briefing';
import './start.css';

/**
 * A short, non-blocking welcome: what SimLoad is, what is loaded, and one
 * button to run it. Shown on the first visit only (and from the top bar's
 * "?" button); the design stays visible and usable behind it.
 */
export function WelcomeCard() {
  const open = useUiStore((s) => s.welcomeOpen);
  const scenarioId = useUiStore((s) => s.scenarioId);
  const prediction = useUiStore((s) => s.prediction);
  const design = useDesignStore((s) => s.design);
  const running = useSimStore((s) => s.running);
  const primary = useRef<HTMLButtonElement>(null);

  const close = () => {
    setIntroSeen();
    useUiStore.getState().setWelcomeOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    primary.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setIntroSeen();
      useUiStore.getState().setWelcomeOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const scenario = findScenario(scenarioId);
  const candidates = design.nodes.filter((n) => n.kind !== 'client');
  const setPrediction = useUiStore.getState().setPrediction;
  const run = () => {
    close();
    simulation.play();
  };

  return (
    <section className="welcome-card" role="dialog" aria-labelledby="welcome-title">
      <button type="button" className="welcome-close" aria-label="Close" onClick={close}>
        ×
      </button>
      <p className="welcome-kicker mono">Welcome to SimLoad</p>
      <p className="welcome-intro">
        Push traffic through a system design and watch where it breaks: queues, latency, errors and
        cost, live in your browser.
      </p>
      <h2 id="welcome-title" className="welcome-title">
        {scenario?.name ?? design.name}
      </h2>
      {scenario && (
        <p className="welcome-goal">
          <span className="mono">Goal</span> {describeGoal(scenario.goal)}.
        </p>
      )}
      {!running && candidates.length > 1 && (
        <div className="welcome-predict">
          <span>Guess what breaks first:</span>
          {candidates.map((n) => (
            <button
              key={n.id}
              type="button"
              aria-pressed={prediction === n.id}
              className={`welcome-chip mono ${prediction === n.id ? 'is-picked' : ''}`}
              onClick={() => setPrediction(prediction === n.id ? null : n.id)}
            >
              {n.label}
            </button>
          ))}
        </div>
      )}
      <div className="welcome-actions">
        {running ? (
          <Button ref={primary} variant="primary" size="sm" onClick={close}>
            Got it
          </Button>
        ) : (
          <Button ref={primary} variant="primary" size="sm" onClick={run}>
            ▶ Run simulation
          </Button>
        )}
        {!running && (
          <Button variant="ghost" size="sm" onClick={close}>
            Look around first
          </Button>
        )}
        <span className="welcome-hint">Reopen anytime with ? in the top bar</span>
      </div>
    </section>
  );
}
