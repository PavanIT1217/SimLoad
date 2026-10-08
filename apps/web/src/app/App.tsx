import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import { Canvas } from '../features/canvas/Canvas';
import { RightPanel } from '../features/inspector/RightPanel';
import { MetricsPanel } from '../features/metrics/MetricsPanel';
import { Palette } from '../features/palette/Palette';
import { useAutosave } from '../features/persistence/useAutosave';
import { GoalBanner } from '../features/scenarios/GoalBanner';
import { useScenarioGoal } from '../features/scenarios/useScenarioGoal';
import { useSimulationSync } from '../features/simulation/useSimulationSync';
import { useLayoutStore } from '../state/layoutStore';
import { useSimStore } from '../state/simStore';
import { useUiStore } from '../state/uiStore';
import { PanelSplitter } from './PanelSplitter';
import { PredictionReveal } from './start/PredictionReveal';
import { StartOverlay } from './start/StartOverlay';
import { TelemetryStrip } from './TelemetryStrip';
import { Toast } from './Toast';
import { TopBar } from './TopBar';
import { useEditorShortcuts } from './useEditorShortcuts';
import { useLayoutShortcuts } from './useLayoutShortcuts';
import './layout.css';

/** Width of the icon-only palette rail when the palette is collapsed. */
const PALETTE_RAIL_PX = 52;

export function App() {
  const theme = useUiStore((s) => s.theme);
  const error = useSimStore((s) => s.error);
  const sizes = useLayoutStore((s) => s.sizes);
  const collapsed = useLayoutStore((s) => s.collapsed);
  useSimulationSync();
  useScenarioGoal();
  useAutosave();
  useLayoutShortcuts();
  useEditorShortcuts();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const layoutVars = {
    '--palette-w': `${collapsed.palette ? PALETTE_RAIL_PX : sizes.palette}px`,
    '--inspector-w': `${collapsed.inspector ? 0 : sizes.inspector}px`,
    '--metrics-h': `${collapsed.metrics ? 0 : sizes.metrics}px`,
    // A collapsed edge panel leaves a wider handle so it is easy to find and grab again.
    '--split-inspector': collapsed.inspector ? '18px' : 'var(--splitter)',
    '--split-metrics': collapsed.metrics ? '18px' : 'var(--splitter)',
  } as CSSProperties;

  return (
    <div className="app" style={layoutVars}>
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
        <Palette collapsed={collapsed.palette} />
        <PanelSplitter panel="palette" />
        <div className="canvas-area">
          <Canvas />
        </div>
        <PanelSplitter panel="inspector" />
        {/* Collapsed panels are unmounted, so hidden charts cost nothing. */}
        {!collapsed.inspector ? <RightPanel /> : <div aria-hidden="true" />}
      </main>
      <PanelSplitter panel="metrics" />
      {!collapsed.metrics ? <MetricsPanel /> : <div aria-hidden="true" />}
      <Toast />
      <PredictionReveal />
      <StartOverlay />
    </div>
  );
}
