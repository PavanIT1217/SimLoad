import { useState } from 'react';
import { simulation } from '../../features/simulation/client';
import { useDesignStore } from '../../state/designStore';
import { useUiStore } from '../../state/uiStore';
import { introSeen, setIntroSeen } from './briefing';
import { LaunchStep } from './LaunchStep';
import { MissionStep } from './MissionStep';
import { WelcomeStep } from './WelcomeStep';
import './start.css';

type Step = 'welcome' | 'mission' | 'launch';
const STEPS: { id: Step; label: string }[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'mission', label: 'Mission' },
  { id: 'launch', label: 'Launch' },
];

/**
 * Start-up briefing: a welcome and introduction, the loaded mission with a
 * prediction to make, then a pre-flight launch sequence. Nothing advances on
 * its own until the visitor presses Launch.
 */
export function StartOverlay() {
  const startup = useUiStore((s) => s.startup);
  const setStartup = useUiStore((s) => s.setStartup);
  const [showIntro] = useState(() => !introSeen());
  const [step, setStep] = useState<Step>(showIntro ? 'welcome' : 'mission');
  const [hideNextTime, setHideNextTime] = useState(false);

  if (!startup) return null;

  const close = (run: boolean) => {
    if (showIntro && hideNextTime) setIntroSeen(true);
    setStartup(null);
    if (run) simulation.play();
    else useUiStore.getState().setPrediction(null);
  };

  const restore = () => {
    const previous = startup.previous;
    if (!previous) return;
    useDesignStore.getState().setDesign(previous.design);
    useUiStore.getState().setScenarioId(previous.scenarioId);
    useUiStore.getState().showToast(`Restored "${previous.design.name}"`);
    close(false);
  };

  const visible = showIntro ? STEPS : STEPS.slice(1);
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
      <div className={`start-panel hud is-${step}`}>
        <ol className="start-steps mono" aria-label="Briefing steps">
          {visible.map((s, i) => (
            <li
              key={s.id}
              className={s.id === step ? 'is-current' : ''}
              aria-current={s.id === step ? 'step' : undefined}
            >
              <span>{String(i + 1).padStart(2, '0')}</span> {s.label}
            </li>
          ))}
        </ol>
        <div key={step} className="start-body">
          {step === 'welcome' && (
            <WelcomeStep
              hideNextTime={hideNextTime}
              onHideNextTime={setHideNextTime}
              onNext={() => setStep('mission')}
              onSkip={() => close(false)}
            />
          )}
          {step === 'mission' && (
            <MissionStep
              startup={startup}
              onBack={showIntro ? () => setStep('welcome') : null}
              onLaunch={() => setStep('launch')}
              onExplore={() => close(false)}
              onRestore={restore}
            />
          )}
          {step === 'launch' && (
            <LaunchStep onLaunched={() => close(true)} onAbort={() => close(false)} />
          )}
        </div>
      </div>
    </div>
  );
}
