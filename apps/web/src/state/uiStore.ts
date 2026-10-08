import { create } from 'zustand';
import type { StartupInfo } from '../features/persistence/bootstrap';
import { readStorage, writeStorage } from '../features/persistence/storage';

export type Theme = 'dark' | 'light';
export type Mode = 'prep' | 'validation';
export type RightTab = 'inspect' | 'insights' | 'plan' | 'calc';
export type DockTab = 'live' | 'compare';

const THEME_KEY = 'simload:theme';

/** Dark ("mission control") is the default; a theme the user picked is remembered. */
function initialTheme(): Theme {
  const stored = readStorage(THEME_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

export interface UiState {
  theme: Theme;
  mode: Mode;
  /** Active prep-mode scenario, or null for a free-form design. */
  scenarioId: string | null;
  toast: string | null;
  rightTab: RightTab;
  dockTab: DockTab;
  /** Start-up announcement (countdown overlay); null once dismissed. */
  startup: StartupInfo | null;
  setStartup(startup: StartupInfo | null): void;
  setRightTab(tab: RightTab): void;
  setDockTab(tab: DockTab): void;
  toggleTheme(): void;
  setMode(mode: Mode): void;
  setScenarioId(id: string | null): void;
  showToast(message: string): void;
  clearToast(): void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  theme: initialTheme(),
  mode: 'prep',
  scenarioId: null,
  toast: null,
  rightTab: 'inspect',
  dockTab: 'live',
  startup: null,
  setStartup: (startup) => set({ startup }),
  setRightTab: (rightTab) => set({ rightTab }),
  setDockTab: (dockTab) => set({ dockTab }),
  toggleTheme: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    writeStorage(THEME_KEY, theme);
    set({ theme });
  },
  setMode: (mode) => set({ mode }),
  setScenarioId: (scenarioId) => set({ scenarioId }),
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
}));
