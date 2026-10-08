import { ErrorChart } from './ErrorChart';
import { LatencyChart } from './LatencyChart';
import { ThroughputChart } from './ThroughputChart';
import { TraceViewer } from './TraceViewer';
import { UtilizationChart } from './UtilizationChart';
import './metrics.css';

export function MetricsPanel() {
  return (
    <section className="metrics" aria-label="Live metrics">
      <LatencyChart />
      <ThroughputChart />
      <ErrorChart />
      <UtilizationChart />
      <TraceViewer />
    </section>
  );
}
