import { useEffect } from 'react';
import { Canvas } from '../features/canvas/Canvas';
import { Inspector } from '../features/inspector/Inspector';
import { MetricsPanel } from '../features/metrics/MetricsPanel';
import { Palette } from '../features/palette/Palette';
import { useAutosave } from '../features/persistence/useAutosave';
import { GoalBanner } from '../features/scenarios/GoalBanner';
import { useScenarioGoal } from '../features/scenarios/useScenarioGoal';
import { useSimulationSync } from '../features/simulation/useSimulationSync';
import { useSimStore } from '../state/simStore';
import { useUiStore } from '../state/uiStore';
import { TelemetryStrip } from './TelemetryStrip';
import { Toast } from './Toast';
import { TopBar } from './TopBar';
import './layout.css';

export function App() {
  const theme = useUiStore((s) => s.theme);
  const error = useSimStore((s) => s.error);
  useSimulationSync();
  useScenarioGoal();
  useAutosave();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="app">
      <TopBar />
      <div className="app-banners">
        <TelemetryStrip />
        <GoalBanner />
        {error && (
          <div className="error-banner" role="alert">
            Simulation stopped: {error}
          </div>
        )}
      </div>
      <main className="workspace">
        <Palette />
        <div className="canvas-area">
          <Canvas />
        </div>
        <Inspector />
      </main>
      <MetricsPanel />
      <Toast />
    </div>
  );
}
