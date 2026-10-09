import { useReactFlow, useViewport } from '@xyflow/react';
import { useDesignStore } from '../../state/designStore';
import { useLayoutStore } from '../../state/layoutStore';
import { autoLayout } from './autoLayout';

const FIT_OPTIONS = { padding: 0.2, maxZoom: 1.2, duration: 250 };

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

  const canUndo = useDesignStore((s) => s.past.length > 0);
  const canRedo = useDesignStore((s) => s.future.length > 0);
  const tidy = () => {
    const store = useDesignStore.getState();
    store.moveNodes(autoLayout(store.design));
    // Let React Flow pick up the new positions before fitting.
    requestAnimationFrame(() => fitView(FIT_OPTIONS));
  };

  return (
    <div className="canvas-toolbar" role="toolbar" aria-label="Canvas">
      <div className="tool-group" role="group" aria-label="Edit">
        <button
          type="button"
          className="tool"
          disabled={!canUndo}
          onClick={() => useDesignStore.getState().undo()}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          type="button"
          className="tool"
          disabled={!canRedo}
          onClick={() => useDesignStore.getState().redo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </button>
        <button type="button" className="tool" onClick={tidy} title="Auto-layout the design">
          <span aria-hidden="true">⊞</span>
          <span className="tool-text">Layout</span>
        </button>
      </div>
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
      {/* Individual panels toggle from their splitter handles or [ ] \ keys. */}
      <div className="tool-group" role="group" aria-label="Panels">
        <button
          type="button"
          className={`tool tool-focus ${focused ? 'is-on' : ''}`}
          aria-pressed={focused}
          onClick={toggleFocus}
          title="Focus mode: hide all panels (F). Toggle single panels with [ ] and \\"
        >
          <span aria-hidden="true">◉</span>
          <span className="tool-text">Focus</span>
        </button>
      </div>
    </div>
  );
}
