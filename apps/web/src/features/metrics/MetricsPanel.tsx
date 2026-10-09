import type { DockTab } from '../../state/uiStore';
import { useUiStore } from '../../state/uiStore';
import { Tabs } from '../../ui/Tabs';
import { CompareView } from './CompareView';
import { ErrorChart } from './ErrorChart';
import { LatencyChart } from './LatencyChart';
import { ReplayBar } from './ReplayBar';
import { ThroughputChart } from './ThroughputChart';
import { TraceViewer } from './TraceViewer';
import { UtilizationChart } from './UtilizationChart';
import './metrics.css';

const TABS: { id: DockTab; label: string }[] = [
  { id: 'live', label: 'Charts' },
  { id: 'traces', label: 'Traces' },
  { id: 'compare', label: 'Compare runs' },
];

export function MetricsPanel() {
  const tab = useUiStore((s) => s.dockTab);
  const setTab = useUiStore((s) => s.setDockTab);
  return (
    <section className="metrics-dock" aria-label="Metrics">
      <div className="dock-head">
        <Tabs items={TABS} value={tab} onChange={setTab} label="Metrics view" />
        {tab !== 'compare' && <ReplayBar />}
      </div>
      {tab === 'live' ? (
        <div className="metrics" role="tabpanel">
          <LatencyChart />
          <ThroughputChart />
          <ErrorChart />
          <UtilizationChart />
        </div>
      ) : tab === 'traces' ? (
        <div className="metrics metrics-traces" role="tabpanel">
          <TraceViewer />
        </div>
      ) : (
        <div role="tabpanel" className="compare-panel">
          <CompareView />
        </div>
      )}
    </section>
  );
}
