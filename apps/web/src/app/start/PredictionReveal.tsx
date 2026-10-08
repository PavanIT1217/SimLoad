import { useCallback, useEffect, useState } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useLayoutStore } from '../../state/layoutStore';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';
import { useTimeout } from '../../ui/useTimeout';
import { judgeBottleneck, type Verdict } from './briefing';

const SHOW_MS = 12_000;

interface Reveal {
  guess: string;
  verdict: Verdict;
}

/**
 * Settles the visitor's "which component cracks first?" call once the run
 * shows a clear bottleneck, then points them at Insights for the why.
 */
export function PredictionReveal() {
  const prediction = useUiStore((s) => s.prediction);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const hide = useCallback(() => setReveal(null), []);
  useTimeout(reveal !== null, SHOW_MS, hide);

  useEffect(() => {
    if (!prediction) return;
    // Subscribe outside React so live ticks do not re-render anything until the call is made.
    return useSimStore.subscribe((state) => {
      const verdict = state.latest && judgeBottleneck(state.latest);
      if (!verdict) return;
      useUiStore.getState().setPrediction(null);
      setReveal({ guess: prediction, verdict });
    });
  }, [prediction]);

  const nodes = useDesignStore((s) => s.design.nodes);
  if (!reveal) return null;
  const label = (id: string | null) => nodes.find((n) => n.id === id)?.label ?? 'that component';
  const { guess, verdict } = reveal;
  const right = verdict.nodeId === guess;
  const headline = verdict.nodeId === null ? 'It held!' : right ? 'Called it!' : 'Plot twist.';
  const detail =
    verdict.nodeId === null
      ? `Nothing cracked at this load, so ${label(guess)} survived. Turn the traffic up and try again.`
      : right
        ? `${label(guess)} was the first to crack, just as you predicted.`
        : `You picked ${label(guess)}, but ${label(verdict.nodeId)} cracked first.`;

  return (
    <div className={`prediction-reveal hud ${right ? 'is-right' : ''}`} role="status">
      <strong className="mono">{headline}</strong>
      <p>{detail}</p>
      <div className="prediction-actions">
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            const layout = useLayoutStore.getState();
            if (layout.collapsed.inspector) layout.toggle('inspector');
            useUiStore.getState().setRightTab('insights');
            hide();
          }}
        >
          See why →
        </Button>
        <Button size="sm" variant="ghost" onClick={hide}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
