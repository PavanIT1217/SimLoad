import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { Connection, EdgeChange, NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { DragEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useUiStore } from '../../state/uiStore';
import { KIND_MIME, readDraggedKind } from './dnd';
import type { SystemFlowEdge } from './FlowEdge';
import { FlowEdge } from './FlowEdge';
import type { SystemFlowNode } from './SystemNode';
import { SystemNode } from './SystemNode';
import './canvas.css';

const NODE_TYPES = { system: SystemNode };
const EDGE_TYPES = { flow: FlowEdge };
const EMPTY_DATA = {};

type Size = { width: number; height: number };

function CanvasInner() {
  const design = useDesignStore((s) => s.design);
  const selection = useDesignStore((s) => s.selection);
  const revision = useDesignStore((s) => s.revision);
  const theme = useUiStore((s) => s.theme);
  const { screenToFlowPosition } = useReactFlow();
  // React Flow reports measured node sizes; keep them so controlled nodes stay visible.
  const [sizes, setSizes] = useState<Record<string, Size>>({});

  const nodes = useMemo<SystemFlowNode[]>(
    () =>
      design.nodes.map((n) => ({
        id: n.id,
        type: 'system',
        position: n.position,
        data: EMPTY_DATA,
        measured: sizes[n.id],
        selected: selection?.type === 'node' && selection.id === n.id,
      })),
    [design.nodes, selection, sizes],
  );

  const edges = useMemo<SystemFlowEdge[]>(
    () =>
      design.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'flow',
        data: { weight: e.weight },
        selected: selection?.type === 'edge' && selection.id === e.id,
      })),
    [design.edges, selection],
  );

  const onNodesChange = useCallback((changes: NodeChange<SystemFlowNode>[]) => {
    const store = useDesignStore.getState();
    const measured: Record<string, Size> = {};
    for (const change of changes) {
      if (change.type === 'position' && change.position) store.moveNode(change.id, change.position);
      else if (change.type === 'select' && change.selected)
        store.select({ type: 'node', id: change.id });
      else if (change.type === 'remove') store.removeNode(change.id);
      else if (change.type === 'dimensions' && change.dimensions)
        measured[change.id] = change.dimensions;
    }
    if (Object.keys(measured).length > 0) setSizes((prev) => ({ ...prev, ...measured }));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<SystemFlowEdge>[]) => {
    const store = useDesignStore.getState();
    for (const change of changes) {
      if (change.type === 'select' && change.selected)
        store.select({ type: 'edge', id: change.id });
      else if (change.type === 'remove') store.removeEdge(change.id);
    }
  }, []);

  const onConnect = useCallback((c: Connection) => {
    useDesignStore.getState().connect(c.source, c.target);
  }, []);

  const onDragOver = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes(KIND_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      const kind = readDraggedKind(event.dataTransfer);
      if (!kind) return;
      event.preventDefault();
      const position = screenToFlowPosition({ x: event.clientX - 90, y: event.clientY - 30 });
      useDesignStore.getState().addNode(kind, position);
    },
    [screenToFlowPosition],
  );

  return (
    <div className="canvas" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        key={revision}
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={() => useDesignStore.getState().select(null)}
        colorMode={theme}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
      >
        <Background id="minor" variant={BackgroundVariant.Lines} gap={24} color="var(--grid)" />
        <Background
          id="major"
          variant={BackgroundVariant.Lines}
          gap={120}
          color="var(--grid-major)"
        />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="canvas-minimap" />
      </ReactFlow>
      {design.nodes.length === 0 && (
        <div className="canvas-empty">
          Drag components from the palette, or pick a scenario to start.
        </div>
      )}
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
