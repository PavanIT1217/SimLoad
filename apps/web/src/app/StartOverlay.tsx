import { useEffect, useRef, useState } from 'react';
import { simulation } from '../features/simulation/client';
import { useDesignStore } from '../state/designStore';
import { useUiStore } from '../state/uiStore';
import { Button } from '../ui/Button';
import './startOverlay.css';

const COUNT_FROM = 3;

/**
 * Start-up announcement: tells the visitor which scenario is loaded and starts
 * the simulation after a 3-2-1 countdown (or straight away with "Start now").
 */
export function StartOverlay() {
  const startup = useUiStore((s) => s.startup);
  const setStartup = useUiStore((s) => s.setStartup);
  const [count, setCount] = useState(COUNT_FROM);
  const startButton = useRef<HTMLButtonElement>(null);

  const close = (run: boolean) => {
    setStartup(null);
    if (run) simulation.play();
  };

  useEffect(() => {
    if (!startup) return;
    startButton.current?.focus();
    const timer = setInterval(() => setCount((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [startup]);

  useEffect(() => {
    if (startup && count <= 0) {
      setStartup(null);
      simulation.play();
    }
  }, [count, startup, setStartup]);

  if (!startup) return null;

  const restore = () => {
    const previous = startup.previous;
    if (!previous) return;
    useDesignStore.getState().setDesign(previous.design);
    useUiStore.getState().setScenarioId(previous.scenarioId);
    useUiStore.getState().showToast(`Restored "${previous.design.name}"`);
    close(false);
  };

  const shown = Math.max(1, count);
  return (
    <div
      className="start-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') close(false);
      }}
    >
      <div className="start-panel hud">
        <p className="start-kicker mono">
          {startup.kind === 'shared' ? 'Shared design loaded' : 'Simulation loaded'}
        </p>
        <h2 id="start-title" className="start-title">
          {startup.title}
        </h2>
        {startup.kind === 'scenario' && <p className="start-scenario mono">Scenario</p>}
        <p className="start-detail">{startup.detail}</p>
        <div className="start-countdown" aria-live="assertive">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="start-ring-track" cx="50" cy="50" r="44" />
            <circle key={shown} className="start-ring" cx="50" cy="50" r="44" />
          </svg>
          <span key={`n${shown}`} className="start-number mono">
            {shown}
          </span>
          <span className="sr-only">Starting in {shown}</span>
        </div>
        <p className="start-hint mono">Starting simulation in {shown}…</p>
        <div className="start-actions">
          <Button ref={startButton} variant="primary" onClick={() => close(true)}>
            ▶ Start now
          </Button>
          <Button variant="ghost" onClick={() => close(false)}>
            Explore first
          </Button>
          {startup.previous && (
            <Button variant="ghost" onClick={restore} title={startup.previous.design.name}>
              Restore my last design
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
