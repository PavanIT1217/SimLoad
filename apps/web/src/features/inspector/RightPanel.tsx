import { diagnose } from '@syssim/engine';
import { useMemo } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import type { RightTab } from '../../state/uiStore';
import { useUiStore } from '../../state/uiStore';
import { Tabs } from '../../ui/Tabs';
import { EstimatorPanel } from '../estimator/EstimatorPanel';
import { InsightsPanel } from '../insights/InsightsPanel';
import { PlannerPanel } from '../planner/PlannerPanel';
import { Inspector } from './Inspector';

/** Critical/warning insight count, refreshed with the live tick. */
function useInsightBadge(): number {
  const design = useDesignStore((s) => s.design);
  const latest = useSimStore((s) => s.latest);
  return useMemo(
    () =>
      diagnose(design, latest).filter((i) => i.severity === 'critical' || i.severity === 'warning')
        .length,
    [design, latest],
  );
}

export function RightPanel() {
  const tab = useUiStore((s) => s.rightTab);
  const setTab = useUiStore((s) => s.setRightTab);
  const badge = useInsightBadge();
  const items: { id: RightTab; label: string; badge?: number }[] = [
    { id: 'inspect', label: 'Inspect' },
    { id: 'insights', label: 'Insights', badge },
    { id: 'plan', label: 'Plan' },
    { id: 'calc', label: 'Calc' },
  ];
  return (
    <aside className="right-panel" aria-label="Details">
      <Tabs items={items} value={tab} onChange={setTab} label="Panel" />
      <div className="right-panel-body" role="tabpanel">
        {tab === 'inspect' && <Inspector />}
        {tab === 'insights' && <InsightsPanel />}
        {tab === 'plan' && <PlannerPanel />}
        {tab === 'calc' && <EstimatorPanel />}
      </div>
    </aside>
  );
}
