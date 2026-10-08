import { useReactFlow, useViewport } from '@xyflow/react';
import { useLayoutStore } from '../../state/layoutStore';
import type { PanelId } from '../../state/layoutStore';

const FIT_OPTIONS = { padding: 0.2, maxZoom: 1.2, duration: 250 };

function PanelToggle({ panel, label, glyph }: { panel: PanelId; label: string; glyph: string }) {
  const shown = useLayoutStore((s) => !s.collapsed[panel]);
  const toggle = useLayoutStore((s) => s.toggle);
  return (
    <button
      type="button"
      className={`tool ${shown ? 'is-on' : ''}`}
      aria-pressed={shown}
      onClick={() => toggle(panel)}
      title={`${shown ? 'Hide' : 'Show'} ${label}`}
    >
      <span aria-hidden="true">{glyph}</span>
      <span className="tool-text">{label}</span>
    </button>
  );
}

/**
 * Viewport and layout controls in a strip above the canvas, so nothing
 * floats over the design itself.
 */
export function CanvasToolbar() {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const minimap = useLayoutStore((s) => s.minimap);
  const toggleMinimap = useLayoutStore((s) => s.toggleMinimap);
  const focused = useLayoutStore(
    (s) => s.collapsed.palette && s.collapsed.inspector && s.collapsed.metrics,
  );
  const toggleFocus = useLayoutStore((s) => s.toggleFocus);

  return (
    <div className="canvas-toolbar" role="toolbar" aria-label="Canvas">
      <div className="tool-group" role="group" aria-label="Zoom">
        <button
          type="button"
          className="tool"
          onClick={() => zoomOut({ duration: 150 })}
          title="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="tool tool-zoom mono"
          onClick={() => zoomTo(1, { duration: 200 })}
          title="Reset zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="tool"
          onClick={() => zoomIn({ duration: 150 })}
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="tool"
          onClick={() => fitView(FIT_OPTIONS)}
          title="Fit design to view"
        >
          <span aria-hidden="true">⛶</span>
          <span className="tool-text">Fit</span>
        </button>
        <button
          type="button"
          className={`tool ${minimap ? 'is-on' : ''}`}
          aria-pressed={minimap}
          onClick={toggleMinimap}
          title={`${minimap ? 'Hide' : 'Show'} minimap`}
        >
          <span aria-hidden="true">▣</span>
          <span className="tool-text">Map</span>
        </button>
      </div>
      <div className="tool-spacer" />
      <div className="tool-group" role="group" aria-label="Panels">
        <PanelToggle panel="palette" label="Palette" glyph="◧" />
        <PanelToggle panel="inspector" label="Inspector" glyph="◨" />
        <PanelToggle panel="metrics" label="Charts" glyph="⬓" />
        <button
          type="button"
          className={`tool tool-focus ${focused ? 'is-on' : ''}`}
          aria-pressed={focused}
          onClick={toggleFocus}
          title="Focus mode: hide all panels (F)"
        >
          <span aria-hidden="true">◉</span>
          <span className="tool-text">Focus</span>
        </button>
      </div>
    </div>
  );
}
