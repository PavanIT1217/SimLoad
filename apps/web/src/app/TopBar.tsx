import { OfflineBadge } from '../features/offline/OfflineBadge';
import { PersistenceMenu } from '../features/persistence/PersistenceMenu';
import { ScenarioPicker } from '../features/scenarios/ScenarioPicker';
import { SimulationControls } from '../features/simulation/SimulationControls';
import { TrafficControls } from '../features/simulation/TrafficControls';
import { useSimStore } from '../state/simStore';
import { useUiStore } from '../state/uiStore';
import { Button } from '../ui/Button';
import { Logo } from './Logo';

export function TopBar() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const running = useSimStore((s) => s.running);
  return (
    <header className="topbar">
      <div className="brand">
        <Logo active={running} />
        <span className="brand-name" title="SimLoad: system design simulator">
          SIM//LOAD
        </span>
        <OfflineBadge />
      </div>
      <div className="segmented" role="group" aria-label="Mode">
        <Button size="sm" active={mode === 'prep'} onClick={() => setMode('prep')}>
          Prep
        </Button>
        <Button size="sm" active={mode === 'validation'} onClick={() => setMode('validation')}>
          Validate
        </Button>
      </div>
      <ScenarioPicker />
      <TrafficControls />
      <SimulationControls />
      <div className="topbar-spacer" />
      <PersistenceMenu />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => useUiStore.getState().setWelcomeOpen(true)}
        aria-label="About SimLoad"
        title="What is SimLoad?"
      >
        ?
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        title={theme === 'dark' ? 'Lab notebook (light)' : 'Mission control (dark)'}
      >
        {theme === 'dark' ? 'Light' : 'Dark'}
      </Button>
    </header>
  );
}
