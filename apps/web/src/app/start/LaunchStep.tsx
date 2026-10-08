import { useEffect, useMemo, useRef, useState } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';
import { preflightLines } from './briefing';

/** Time between pre-flight checklist lines. */
const LINE_MS = 650;
/** Length of each T-minus count. */
const COUNT_MS = 1_000;
const COUNT_FROM = 3;

export interface LaunchStepProps {
  onLaunched(): void;
  onAbort(): void;
}

/**
 * Step 3: a pre-flight checklist ticks through the design, then a T-minus
 * 3-2-1 with a reminder of what to watch, then the run starts. Only reached
 * when the visitor presses Launch, so nothing closes before they are ready.
 */
export function LaunchStep({ onLaunched, onAbort }: LaunchStepProps) {
  const design = useDesignStore((s) => s.design);
  const prediction = useUiStore((s) => s.prediction);
  const lines = useMemo(() => preflightLines(design), [design]);
  const [elapsed, setElapsed] = useState(0);
  const skip = useRef<HTMLButtonElement>(null);
  const launched = useRef(onLaunched);
  useEffect(() => {
    launched.current = onLaunched;
  }, [onLaunched]);

  const checklistMs = lines.length * LINE_MS;
  const totalMs = checklistMs + COUNT_FROM * COUNT_MS;

  useEffect(() => {
    skip.current?.focus();
    const started = performance.now();
    let frame = 0;
    let last = -1;
    const step = (now: number) => {
      const ms = now - started;
      // Re-render only when a line or a count changes, not on every frame.
      const bucket = Math.floor(ms / (LINE_MS / 2));
      if (bucket !== last) {
        last = bucket;
        setElapsed(ms);
      }
      if (ms >= totalMs) launched.current();
      else frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [totalMs]);

  const done = Math.min(lines.length, Math.floor(elapsed / LINE_MS));
  const counting = elapsed >= checklistMs;
  const count = Math.max(1, COUNT_FROM - Math.floor((elapsed - checklistMs) / COUNT_MS));
  const watched = design.nodes.find((n) => n.id === prediction)?.label;

  return (
    <>
      <p className="start-kicker mono">Pre-flight</p>
      <h2 id="start-title" className="start-title">
        {counting ? 'Launching' : 'Preparing launch'}
      </h2>
      <ol className="start-checklist mono" aria-live="polite">
        {lines.map((line, i) => (
          <li
            key={line}
            className={i < done ? 'is-done' : i === done && !counting ? 'is-active' : ''}
          >
            <span className="start-check" aria-hidden="true">
              {i < done ? '✓' : i === done && !counting ? '›' : '·'}
            </span>
            {line}
          </li>
        ))}
      </ol>
      <div className={`start-countdown ${counting ? 'is-on' : ''}`} aria-live="assertive">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="start-ring-track" cx="50" cy="50" r="44" />
          {counting && <circle key={count} className="start-ring" cx="50" cy="50" r="44" />}
        </svg>
        <span key={counting ? count : 'idle'} className="start-number mono">
          {counting ? count : '…'}
        </span>
        {counting && <span className="sr-only">T minus {count}</span>}
      </div>
      <p className="start-watch">
        {watched ? (
          <>
            Your call: <strong>{watched}</strong> breaks first. Watch its gauge.
          </>
        ) : (
          'Watch the canvas: components glow amber, then red, as they saturate.'
        )}
      </p>
      <div className="start-actions">
        <Button ref={skip} variant="primary" onClick={onLaunched}>
          Skip ▶
        </Button>
        <Button variant="ghost" onClick={onAbort}>
          Abort
        </Button>
      </div>
    </>
  );
}
