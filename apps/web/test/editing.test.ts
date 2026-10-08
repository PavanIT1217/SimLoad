import { createDesign, createEdge, createNode } from '@simload/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { LAYER_GAP, autoLayout } from '../src/features/canvas/autoLayout';
import { useDesignStore } from '../src/state/designStore';

const design = () =>
  createDesign(
    'd',
    [
      createNode('client', 'client'),
      createNode('lb', 'loadBalancer'),
      createNode('a', 'service'),
      createNode('b', 'service'),
      createNode('db', 'database'),
    ],
    [
      createEdge('client', 'lb'),
      createEdge('lb', 'a'),
      createEdge('lb', 'b'),
      createEdge('a', 'db'),
      createEdge('b', 'db'),
    ],
  );

describe('autoLayout', () => {
  it('places each node one column after its deepest parent', () => {
    const p = autoLayout(design());
    expect(p.client?.x).toBe(0);
    expect(p.lb?.x).toBe(LAYER_GAP);
    expect(p.a?.x).toBe(2 * LAYER_GAP);
    expect(p.db?.x).toBe(3 * LAYER_GAP);
    expect(p.a?.y).not.toBe(p.b?.y);
  });
});

describe('undo / redo / clipboard', () => {
  beforeEach(() => useDesignStore.getState().setDesign(design()));

  it('undoes and redoes edits', () => {
    const store = useDesignStore.getState();
    store.updateNodeConfig('a', { instances: 9 });
    store.removeNode('b');
    expect(useDesignStore.getState().design.nodes).toHaveLength(4);
    useDesignStore.getState().undo();
    expect(useDesignStore.getState().design.nodes).toHaveLength(5);
    useDesignStore.getState().undo();
    expect(
      useDesignStore.getState().design.nodes.find((n) => n.id === 'a')?.config.instances,
    ).not.toBe(9);
    useDesignStore.getState().redo();
    expect(useDesignStore.getState().design.nodes.find((n) => n.id === 'a')?.config.instances).toBe(
      9,
    );
  });

  it('merges a drag into a single undo step', () => {
    const store = useDesignStore.getState();
    for (let i = 0; i < 20; i++) store.moveNode('a', { x: i, y: i });
    expect(useDesignStore.getState().past).toHaveLength(1);
    useDesignStore.getState().undo();
    expect(useDesignStore.getState().design.nodes.find((n) => n.id === 'a')?.position).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('copies and pastes a component with a fresh id', () => {
    const store = useDesignStore.getState();
    store.select({ type: 'node', id: 'a' });
    expect(store.copySelection()).toBe(true);
    const id = useDesignStore.getState().paste();
    const state = useDesignStore.getState();
    expect(id).not.toBe('a');
    expect(state.design.nodes.find((n) => n.id === id)?.label).toMatch(/copy$/);
    expect(state.selection).toEqual({ type: 'node', id });
  });
});
