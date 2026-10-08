import type { DesignNode, NodeTickState } from '@syssim/engine';
import { useState } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';
import { Field, NumberInput } from '../../ui/Field';
import { Section } from '../../ui/Section';
import { simulation } from '../simulation/client';

const LATENCY_FAULT_MS = 15_000;
const STORM_ERROR_RATE = 0.5;
const STORM_DURATION_MS = 5_000;
const STORM_RETRIES = 3;

export interface ChaosActionsProps {
  node: DesignNode;
  live: NodeTickState | undefined;
}

export function ChaosActions({ node, live }: ChaosActionsProps) {
  const [addMs, setAddMs] = useState(200);
  const showToast = useUiStore((s) => s.showToast);
  const killed = live?.faults.includes('kill') ?? false;
  const caching = node.kind === 'cache' || node.kind === 'cdn';

  const retryStorm = () => {
    const store = useDesignStore.getState();
    const callers = store.design.edges.filter((e) => e.target === node.id).map((e) => e.source);
    for (const id of callers) {
      const caller = store.design.nodes.find((n) => n.id === id);
      if (caller && caller.config.retries < STORM_RETRIES) {
        store.updateNodeConfig(id, { retries: STORM_RETRIES });
      }
    }
    simulation.injectFault(
      node.id,
      { kind: 'errorRate', rate: STORM_ERROR_RATE },
      STORM_DURATION_MS,
    );
    showToast(
      `${node.label} fails 50% of calls for 5s; callers now retry up to ${STORM_RETRIES}x. ` +
        'Watch the inflow climb.',
    );
  };

  return (
    <Section title="Chaos">
      <div className="chaos-grid">
        <Button
          variant={killed ? 'primary' : 'danger'}
          onClick={() =>
            killed
              ? simulation.clearFault(node.id, 'kill')
              : simulation.injectFault(node.id, { kind: 'kill' })
          }
        >
          {killed ? 'Revive node' : 'Kill node'}
        </Button>
        <Button onClick={retryStorm}>Trigger retry storm</Button>
        {caching && (
          <Button onClick={() => simulation.injectFault(node.id, { kind: 'flushCache' })}>
            Flush cache
          </Button>
        )}
        <Button variant="ghost" onClick={() => simulation.clearFault(node.id)}>
          Clear faults
        </Button>
      </div>
      <div className="chaos-latency">
        <Field label="Extra latency (ms)">
          <NumberInput value={addMs} min={1} onChange={setAddMs} ariaLabel="Extra latency" />
        </Field>
        <Button
          onClick={() =>
            simulation.injectFault(node.id, { kind: 'latency', addMs }, LATENCY_FAULT_MS)
          }
        >
          Add for 15s
        </Button>
      </div>
    </Section>
  );
}
