import { createDesign, createEdge, createNode } from '@syssim/engine';
import { describe, expect, it } from 'vitest';
import { parseLatencyCsv } from '../src/features/inspector/csv';
import { designFileName } from '../src/features/persistence/designFile';
import { DesignParseError, parseDesign, parseDesignJson } from '../src/features/persistence/schema';
import { decodeDesign, designFromHash, encodeDesign } from '../src/features/persistence/shareLink';

const sample = createDesign(
  'Café ☕ design',
  [createNode('client', 'client'), createNode('svc', 'service', { x: 10, y: 20 })],
  [createEdge('client', 'svc', 2)],
  { peakRps: 1234 },
);

describe('share links', () => {
  it('round-trip a design (including non-ASCII names) through the URL hash', () => {
    const encoded = encodeDesign(sample);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeDesign(encoded)).toEqual(sample);
    expect(designFromHash(`#design=${encoded}`)).toEqual(sample);
  });

  it('returns null when the hash has no design', () => {
    expect(designFromHash('')).toBeNull();
    expect(designFromHash('#other=1')).toBeNull();
  });
});

describe('parseDesign', () => {
  it('fills missing config fields with component defaults', () => {
    const design = parseDesign({
      nodes: [
        { id: 'c', kind: 'client' },
        { id: 's', kind: 'service', config: { instances: 7 } },
      ],
      edges: [{ source: 'c', target: 's' }],
    });
    expect(design.nodes[1]?.config.instances).toBe(7);
    expect(design.nodes[1]?.config.capacityRps).toBeGreaterThan(0);
    expect(design.edges[0]).toEqual({
      id: 'c->s',
      source: 'c',
      target: 's',
      weight: 1,
      traffic: 'all',
    });
    expect(design.traffic.profile).toBe('steady');
  });

  it('rejects malformed input', () => {
    expect(() => parseDesignJson('{nope')).toThrow(DesignParseError);
    expect(() => parseDesign({ nodes: 'x', edges: [] })).toThrow(DesignParseError);
    expect(() => parseDesign({ nodes: [{ id: 'a', kind: 'mainframe' }], edges: [] })).toThrow(
      /unknown kind/,
    );
  });

  it('builds a safe file name', () => {
    expect(designFileName(sample)).toBe('caf-design.syssim.json');
  });
});

describe('parseLatencyCsv', () => {
  it('reads a bare column of numbers', () => {
    expect(parseLatencyCsv('12\n15.5\n\n20\n')).toEqual([12, 15.5, 20]);
  });

  it('prefers a latency-like column when there is a header', () => {
    const csv = 'id,status,latency_ms\n1,200,12\n2,500,40\n3,200,x\n';
    expect(parseLatencyCsv(csv)).toEqual([12, 40]);
  });

  it('falls back to the first numeric column and handles semicolons', () => {
    expect(parseLatencyCsv('name;value\na;3\nb;4')).toEqual([3, 4]);
  });
});
