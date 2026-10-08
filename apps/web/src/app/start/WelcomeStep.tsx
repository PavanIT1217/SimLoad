import { useEffect, useRef } from 'react';
import { Button } from '../../ui/Button';

const PILLARS = [
  {
    icon: '◇',
    title: 'Simulate',
    text: 'Real queueing maths, retries, timeouts, caches and autoscaling, from 1 to 100M req/s.',
  },
  {
    icon: '◈',
    title: 'Diagnose',
    text: 'Insights name the bottleneck, the planner sizes the fix, and costs compare AWS, Azure and GCP.',
  },
  {
    icon: '◆',
    title: 'Practise',
    text: 'Nine interview scenarios with pass/fail goals, staged hints and chaos drills.',
  },
];

export interface WelcomeStepProps {
  hideNextTime: boolean;
  onHideNextTime(hide: boolean): void;
  onNext(): void;
  onSkip(): void;
}

/** Step 1: what SimLoad is and what you can do with it. */
export function WelcomeStep({ hideNextTime, onHideNextTime, onNext, onSkip }: WelcomeStepProps) {
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => next.current?.focus(), []);
  return (
    <>
      <p className="start-kicker mono">System design simulator</p>
      <h2 id="start-title" className="start-title">
        Welcome to SimLoad
      </h2>
      <p className="start-lead">
        A wind tunnel for software architecture. Draw a system, push real traffic through it and
        watch queues build, latency climb and failures cascade, live in your browser.
      </p>
      <ul className="start-pillars">
        {PILLARS.map((p, i) => (
          <li key={p.title} style={{ animationDelay: `${150 + i * 120}ms` }}>
            <span className="start-pillar-icon" aria-hidden="true">
              {p.icon}
            </span>
            <strong>{p.title}</strong>
            <span>{p.text}</span>
          </li>
        ))}
      </ul>
      <div className="start-actions">
        <Button ref={next} variant="primary" onClick={onNext}>
          Next: your mission →
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Skip intro
        </Button>
      </div>
      <label className="start-optout">
        <input
          type="checkbox"
          checked={hideNextTime}
          onChange={(e) => onHideNextTime(e.target.checked)}
        />
        Don't show this intro again
      </label>
    </>
  );
}
