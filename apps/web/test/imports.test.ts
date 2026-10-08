import { createRng, validateDesign } from '@syssim/engine';
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { importLoadTest } from '../src/features/inspector/loadTestImport';
import { parseDrawio, parseMermaid } from '../src/features/persistence/diagramImport';
import { importDesignFile } from '../src/features/persistence/fileImport';
import { inferKind } from '../src/features/persistence/kindInference';

describe('load-test imports', () => {
  it('reads k6 summary percentiles', () => {
    const k6 = JSON.stringify({
      metrics: { http_req_duration: { values: { med: 40, 'p(90)': 70, 'p(95)': 90, avg: 45 } } },
    });
    const r = importLoadTest(k6);
    expect(r.format).toBe('k6-summary');
    expect(r.fit.medianMs).toBe(40);
    expect(r.fit.sigma).toBeCloseTo(Math.log(90 / 40) / 1.6449, 3);
  });

  it('reads k6 JSON points', () => {
    const rng = createRng(3);
    const lines = Array.from({ length: 2_000 }, () =>
      JSON.stringify({
        type: 'Point',
        metric: 'http_req_duration',
        data: { value: rng.lognormal(25, 0.3) },
      }),
    );
    lines.unshift(JSON.stringify({ type: 'Metric', metric: 'http_req_duration', data: {} }));
    const r = importLoadTest(lines.join('\n'));
    expect(r.format).toBe('k6-json');
    expect(r.fit.medianMs).toBeCloseTo(25, 0);
  });

  it('reads Gatling simulation.log request rows', () => {
    const log = [
      'RUN\tSim\tsim\t1700000000000\t\t3.9',
      'REQUEST\t\tGet home\t1700000000100\t1700000000130\tOK\t',
      'REQUEST\t\tGet home\t1700000000200\t1700000000260\tOK\t',
      'USER\tScn\tSTART\t1700000000000\t1700000000000',
    ].join('\n');
    const r = importLoadTest(log);
    expect(r.format).toBe('gatling');
    expect(r.samples).toEqual([30, 60]);
  });

  it('reads JMeter JTL elapsed times', () => {
    const jtl =
      'timeStamp,elapsed,label,responseCode\n1,120,home,200\n2,80,home,200\n3,100,home,200';
    const r = importLoadTest(jtl);
    expect(r.format).toBe('csv');
    expect(r.samples).toEqual([120, 80, 100]);
  });
});

describe('diagram imports', () => {
  it('infers component kinds from labels and shapes', () => {
    expect(inferKind('Mobile app')).toBe('client');
    expect(inferKind('Redis')).toBe('cache');
    expect(inferKind('Kafka topic')).toBe('queue');
    expect(inferKind('Orders', 'shape=cylinder3')).toBe('database');
    expect(inferKind('Stripe')).toBe('externalApi');
    expect(inferKind('Checkout')).toBe('service');
  });

  it('parses Mermaid flowcharts with shapes, labels and chains', () => {
    const g = parseMermaid(`flowchart LR
      U[Users] --> LB[Load balancer] -->|http| API(Orders API)
      API --> C[Redis cache]
      API --> DB[(Orders)]
      %% a comment`);
    expect(g.nodes.map((n) => [n.id, n.kind])).toEqual([
      ['U', 'client'],
      ['LB', 'loadBalancer'],
      ['API', 'service'],
      ['C', 'cache'],
      ['DB', 'database'],
    ]);
    expect(g.edges).toHaveLength(4);
  });

  it('parses compressed draw.io files', async () => {
    const xml =
      '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
      '<mxCell id="a" value="Web &amp;amp; mobile users" vertex="1" parent="1"><mxGeometry x="10" y="20" as="geometry"/></mxCell>' +
      '<mxCell id="b" value="Postgres" style="shape=cylinder3" vertex="1" parent="1"><mxGeometry x="200" y="20" as="geometry"/></mxCell>' +
      '<mxCell id="e" edge="1" source="a" target="b" parent="1"/></root></mxGraphModel>';
    const payload = deflateRawSync(Buffer.from(encodeURIComponent(xml))).toString('base64');
    const g = await parseDrawio(
      `<mxfile><diagram id="x" name="Page-1">${payload}</diagram></mxfile>`,
    );
    expect(g.nodes.map((n) => n.kind)).toEqual(['client', 'database']);
    expect(g.nodes[0]?.label).toBe('Web & mobile users');
    expect(g.nodes[1]?.x).toBe(200);
    expect(g.edges).toEqual([{ source: 'a', target: 'b' }]);
  });

  it('builds a valid, laid-out design and adds a client when missing', async () => {
    const { design, format } = await importDesignFile(
      'graph TD\n  API[Orders API] --> DB[(Orders)]',
      'orders.mmd',
    );
    expect(format).toBe('mermaid');
    expect(design.name).toBe('orders');
    expect(design.nodes[0]?.kind).toBe('client');
    expect(validateDesign(design).filter((i) => i.severity === 'error')).toEqual([]);
    expect(new Set(design.nodes.map((n) => n.position.x)).size).toBeGreaterThan(1);
  });
});
