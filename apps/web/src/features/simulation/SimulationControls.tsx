import { useSimStore } from '../../state/simStore';
import { Button } from '../../ui/Button';
import { NumberInput } from '../../ui/Field';
import { formatSimTime } from '../../ui/format';
import { simulation } from './client';
import { SPEEDS } from './protocol';

export function SimulationControls() {
  const running = useSimStore((s) => s.running);
  const ready = useSimStore((s) => s.ready);
  const speed = useSimStore((s) => s.speed);
  const seed = useSimStore((s) => s.seed);
  const setSeed = useSimStore((s) => s.setSeed);
  const timeMs = useSimStore((s) => s.latest?.timeMs ?? 0);

  return (
    <div className="topbar-group" role="group" aria-label="Simulation controls">
      <Button
        variant="primary"
        disabled={!ready}
        onClick={() => (running ? simulation.pause() : simulation.play())}
        aria-label={running ? 'Pause' : 'Run'}
      >
        {running ? '❚❚ Pause' : '▶ Run'}
      </Button>
      <Button
        size="sm"
        disabled={!ready || running}
        onClick={() => simulation.step()}
        title="Advance one 100 ms tick"
      >
        Step
      </Button>
      <Button size="sm" disabled={!ready} onClick={() => simulation.reset()}>
        Reset
      </Button>
      <span className="sim-clock mono" title="Simulated time">
        T+{formatSimTime(timeMs)}
      </span>
      <label className="topbar-field">
        <span className="topbar-label">Speed</span>
        <select
          className="input"
          value={speed}
          onChange={(e) => simulation.setSpeed(Number(e.target.value))}
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
      </label>
      <label className="topbar-field topbar-seed">
        <span className="topbar-label">Seed</span>
        <NumberInput
          value={seed}
          min={0}
          max={2 ** 32 - 1}
          onChange={(v) => setSeed(Math.floor(v))}
          ariaLabel="Random seed"
        />
      </label>
    </div>
  );
}
