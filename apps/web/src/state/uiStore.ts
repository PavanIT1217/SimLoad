import { create } from 'zustand';
import { readStorage, writeStorage } from '../features/persistence/storage';

export type Theme = 'dark' | 'light';
export type Mode = 'prep' | 'validation';

const THEME_KEY = 'syssim:theme';

function initialTheme(): Theme {
  const stored = readStorage(THEME_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: light)').matches
  ) {
    return 'light';
  }
  return 'dark';
}

export interface UiState {
  theme: Theme;
  mode: Mode;
  /** Active prep-mode scenario, or null for a free-form design. */
  scenarioId: string | null;
  toast: string | null;
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
