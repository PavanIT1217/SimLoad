import { create } from 'zustand';
import { readStorage, writeStorage } from '../features/persistence/storage';

export type PanelId = 'palette' | 'inspector' | 'metrics';

export interface PanelLimits {
  min: number;
  max: number;
  initial: number;
}

/** Size limits in px: widths for side panels, height for the metrics dock. */
export const PANEL_LIMITS: Record<PanelId, PanelLimits> = {
  palette: { min: 160, max: 360, initial: 220 },
  inspector: { min: 260, max: 560, initial: 340 },
  metrics: { min: 160, max: 560, initial: 300 },
};

/** CSS custom property each panel's size is written to. */
export const PANEL_VARS: Record<PanelId, string> = {
  palette: '--palette-w',
  inspector: '--inspector-w',
  metrics: '--metrics-h',
};

const STORAGE_KEY = 'syssim:layout:v1';

export interface LayoutState {
  sizes: Record<PanelId, number>;
  collapsed: Record<PanelId, boolean>;
  minimap: boolean;
  setSize(panel: PanelId, size: number): void;
  toggle(panel: PanelId): void;
  /** Collapses every panel, or restores them all if they are already collapsed. */
  toggleFocus(): void;
  toggleMinimap(): void;
  resetLayout(): void;
}

type Persisted = Pick<LayoutState, 'sizes' | 'collapsed' | 'minimap'>;

const DEFAULTS: Persisted = {
  sizes: { palette: 220, inspector: 340, metrics: 300 },
  collapsed: { palette: false, inspector: false, metrics: false },
  minimap: true,
};

export function clampSize(panel: PanelId, size: number): number {
  const { min, max } = PANEL_LIMITS[panel];
  return Math.round(Math.min(max, Math.max(min, size)));
}

function load(): Persisted {
  try {
    const raw = readStorage(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const data = JSON.parse(raw) as Partial<Persisted>;
    const sizes = { ...DEFAULTS.sizes, ...data.sizes };
    for (const panel of Object.keys(sizes) as PanelId[])
      sizes[panel] = clampSize(panel, sizes[panel]);
    return {
      sizes,
      collapsed: { ...DEFAULTS.collapsed, ...data.collapsed },
      minimap: typeof data.minimap === 'boolean' ? data.minimap : DEFAULTS.minimap,
    };
  } catch {
    return DEFAULTS;
  }
}

export const useLayoutStore = create<LayoutState>()((set, get) => {
  const save = () => {
    const { sizes, collapsed, minimap } = get();
    writeStorage(STORAGE_KEY, JSON.stringify({ sizes, collapsed, minimap }));
  };
  return {
    ...load(),
    setSize: (panel, size) => {
      set((s) => ({
        sizes: { ...s.sizes, [panel]: clampSize(panel, size) },
        collapsed: { ...s.collapsed, [panel]: false },
      }));
      save();
    },
    toggle: (panel) => {
      set((s) => ({ collapsed: { ...s.collapsed, [panel]: !s.collapsed[panel] } }));
      save();
    },
    toggleFocus: () => {
      const { collapsed } = get();
      const all = collapsed.palette && collapsed.inspector && collapsed.metrics;
      set({ collapsed: { palette: !all, inspector: !all, metrics: !all } });
      save();
    },
    toggleMinimap: () => {
      set((s) => ({ minimap: !s.minimap }));
      save();
    },
    resetLayout: () => {
      set(DEFAULTS);
      save();
    },
  };
});
