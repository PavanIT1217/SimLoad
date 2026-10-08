import { PersistenceMenu } from '../features/persistence/PersistenceMenu';
import { ScenarioPicker } from '../features/scenarios/ScenarioPicker';
import { SimulationControls } from '../features/simulation/SimulationControls';
import { TrafficControls } from '../features/simulation/TrafficControls';
import { useUiStore } from '../state/uiStore';
import { Button } from '../ui/Button';

export function TopBar() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  return (
    <header className="topbar">
      <div className="brand">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={22} height={22} />
        <span>System Design Simulator</span>
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
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </Button>
    </header>
  );
}
