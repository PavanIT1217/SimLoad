import { useDesignStore } from '../../state/designStore';
import { DesignOverview } from './DesignOverview';
import { EdgeInspector } from './EdgeInspector';
import { NodeInspector } from './NodeInspector';
import './inspector.css';

export function Inspector() {
  const selection = useDesignStore((s) => s.selection);
  const node = useDesignStore((s) =>
    selection?.type === 'node' ? s.design.nodes.find((n) => n.id === selection.id) : undefined,
  );
  const edge = useDesignStore((s) =>
    selection?.type === 'edge' ? s.design.edges.find((e) => e.id === selection.id) : undefined,
  );
  return (
    <aside className="inspector" aria-label="Inspector">
      {node ? (
        <NodeInspector node={node} />
      ) : edge ? (
        <EdgeInspector edge={edge} />
      ) : (
        <DesignOverview />
      )}
    </aside>
  );
}
