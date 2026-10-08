import type { DesignEdge } from '@syssim/engine';
import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import { Button } from '../../ui/Button';
import { Field, NumberInput } from '../../ui/Field';
import { formatRps } from '../../ui/format';
import { Section, Stat } from '../../ui/Section';

export interface EdgeInspectorProps {
  edge: DesignEdge;
}

export function EdgeInspector({ edge }: EdgeInspectorProps) {
  const nodes = useDesignStore((s) => s.design.nodes);
  const edges = useDesignStore((s) => s.design.edges);
  const siblings = edges.filter((e) => e.source === edge.source);
  const updateEdge = useDesignStore((s) => s.updateEdge);
  const removeEdge = useDesignStore((s) => s.removeEdge);
  const rps = useSimStore((s) => s.latest?.edges[edge.id] ?? 0);
  const label = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;
  const total = siblings.reduce((sum, e) => sum + e.weight, 0);

  return (
    <div className="inspector-content">
      <header className="inspector-header">
        <div className="inspector-titles">
          <strong>
            {label(edge.source)} → {label(edge.target)}
          </strong>
          <span className="muted small">Connection</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => removeEdge(edge.id)}>
          Delete
        </Button>
      </header>
      <Section title="Routing">
        <Field label="Weight" hint="Relative share of the source's outgoing traffic">
          <NumberInput
            value={edge.weight}
            min={0.01}
            step={0.5}
            onChange={(weight) => updateEdge(edge.id, { weight })}
          />
        </Field>
        <div className="stat-grid">
          <Stat label="Share" value={`${((edge.weight / (total || 1)) * 100).toFixed(0)}%`} />
          <Stat label="Live flow" value={formatRps(rps)} />
        </div>
        <p className="muted small">
          Flow includes retries. Edge thickness on the canvas follows log10 of the flow.
        </p>
      </Section>
    </div>
  );
}
