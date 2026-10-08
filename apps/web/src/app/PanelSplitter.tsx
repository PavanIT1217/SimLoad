import { PANEL_LIMITS, PANEL_VARS, useLayoutStore } from '../state/layoutStore';
import type { PanelId } from '../state/layoutStore';
import { Splitter } from '../ui/Splitter';

const LABELS: Record<PanelId, string> = {
  palette: 'component palette',
  inspector: 'inspector',
  metrics: 'charts',
};

/** A Splitter bound to one panel in the layout store. */
export function PanelSplitter({ panel }: { panel: PanelId }) {
  const size = useLayoutStore((s) => s.sizes[panel]);
  const collapsed = useLayoutStore((s) => s.collapsed[panel]);
  const setSize = useLayoutStore((s) => s.setSize);
  const toggle = useLayoutStore((s) => s.toggle);
  const { min, max } = PANEL_LIMITS[panel];
  return (
    <Splitter
      axis={panel === 'metrics' ? 'y' : 'x'}
      label={LABELS[panel]}
      cssVar={PANEL_VARS[panel]}
      size={size}
      min={min}
      max={max}
      invert={panel !== 'palette'}
      collapsed={collapsed}
      onCommit={(v) => setSize(panel, v)}
      onToggle={() => toggle(panel)}
    />
  );
}
