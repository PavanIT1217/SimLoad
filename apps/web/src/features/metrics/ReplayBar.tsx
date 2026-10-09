import { useSimStore } from '../../state/simStore';
import { Button } from '../../ui/Button';
import { formatSimTime } from '../../ui/format';

/** Timeline scrubber: while paused, drag to replay recorded node states on the canvas. */
export function ReplayBar() {
  const history = useSimStore((s) => s.history);
  const running = useSimStore((s) => s.running);
  const index = useSimStore((s) => s.replayIndex);
  const setIndex = useSimStore((s) => s.setReplayIndex);
  const last = history.length - 1;
  const point = index !== null ? history[index] : history[last];
  const disabled = running || history.length < 2;
  return (
    <div className={`replay-bar ${index !== null ? 'is-replaying' : ''}`}>
      {index !== null && <span className="replay-label mono">Replay</span>}
      <input
        type="range"
        min={0}
        max={Math.max(0, last)}
        value={index ?? last}
        disabled={disabled}
        aria-label="Replay position"
        aria-valuetext={point ? formatSimTime(point.t * 1000) : undefined}
        title={running ? 'Pause the simulation to replay' : 'Drag to replay the run on the canvas'}
        onChange={(e) => {
          const i = Number(e.target.value);
          setIndex(i >= last ? null : i);
        }}
      />
      <span className="replay-time mono">T+{formatSimTime((point?.t ?? 0) * 1000)}</span>
      {index !== null && (
        <Button size="sm" variant="ghost" onClick={() => setIndex(null)}>
          Back to live
        </Button>
      )}
    </div>
  );
}
