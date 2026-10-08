import { COMPONENT_KINDS, KIND_LABELS } from '@syssim/engine';
import type { ComponentKind } from '@syssim/engine';
import type { DragEvent } from 'react';
import { useDesignStore } from '../../state/designStore';
import { KindIcon } from '../../ui/KindIcon';
import { KIND_MIME } from '../canvas/dnd';
import './palette.css';

const DESCRIPTIONS: Record<ComponentKind, string> = {
  client: 'Traffic source',
  cdn: 'Edge cache for reads',
  loadBalancer: 'Spreads load',
  service: 'Stateless compute',
  cache: 'In-memory reads',
  queue: 'Async buffer',
  database: 'Primary + replicas',
  externalApi: 'Third-party call',
};

function onDragStart(event: DragEvent, kind: ComponentKind) {
  event.dataTransfer.setData(KIND_MIME, kind);
  event.dataTransfer.effectAllowed = 'copy';
}

export function Palette() {
  const addNode = useDesignStore((s) => s.addNode);
  const count = useDesignStore((s) => s.design.nodes.length);
  return (
    <nav className="palette" aria-label="Component palette">
      <h2 className="panel-title">Components</h2>
      <ul>
        {COMPONENT_KINDS.map((kind) => (
          <li key={kind}>
            <button
              type="button"
              className="palette-item"
              draggable
              onDragStart={(e) => onDragStart(e, kind)}
              onClick={() => addNode(kind, { x: 80 + (count % 5) * 60, y: 60 + (count % 7) * 50 })}
              title={`Drag onto the canvas (or click to add) a ${KIND_LABELS[kind]}`}
            >
              <span className={`palette-icon kind-${kind}`}>
                <KindIcon kind={kind} />
              </span>
              <span className="palette-text">
                <span className="palette-name">{KIND_LABELS[kind]}</span>
                <span className="palette-desc">{DESCRIPTIONS[kind]}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="palette-tip">Connect nodes by dragging from a right handle to a left handle.</p>
    </nav>
  );
}
