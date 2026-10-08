import { describe, expect, it } from 'vitest';
import { createDesign, createEdge, createNode, hasErrors, validateDesign } from '../src';
import { threeTier } from './helpers';

const codes = (design: Parameters<typeof validateDesign>[0]) =>
  validateDesign(design).map((i) => i.code);

describe('validateDesign', () => {
  it('accepts a well-formed design', () => {
    expect(validateDesign(threeTier())).toEqual([]);
  });

  it('requires a client', () => {
    const design = createDesign('x', [createNode('svc', 'service')], []);
    expect(codes(design)).toContain('NO_CLIENT');
    expect(hasErrors(validateDesign(design))).toBe(true);
  });

  it('detects cycles and names the nodes involved', () => {
    const design = threeTier();
    design.edges.push(createEdge('db', 'lb'));
    const issue = validateDesign(design).find((i) => i.code === 'CYCLE');
    expect(issue?.severity).toBe('error');
    expect(issue?.nodeIds?.sort()).toEqual(['db', 'lb', 'svc']);
  });

  it('warns about nodes no client can reach', () => {
    const design = threeTier();
    design.nodes.push(createNode('orphan', 'cache'));
    const issue = validateDesign(design).find((i) => i.code === 'UNREACHABLE');
    expect(issue?.severity).toBe('warning');
    expect(issue?.nodeIds).toEqual(['orphan']);
    expect(hasErrors(validateDesign(design))).toBe(false);
  });

  it('flags dangling edges and self loops', () => {
    const design = threeTier();
    design.edges.push(createEdge('svc', 'ghost'), createEdge('svc', 'svc'));
    expect(codes(design)).toEqual(expect.arrayContaining(['DANGLING_EDGE', 'SELF_LOOP']));
  });

  it('flags invalid configuration and edge weights', () => {
    const design = threeTier({ svc: { hitRatio: 2, instances: 0 } });
    design.edges = design.edges.map((e, i) => (i === 0 ? { ...e, weight: 0 } : e));
    const issues = validateDesign(design).filter((i) => i.code === 'INVALID_CONFIG');
    expect(issues).toHaveLength(2);
    expect(issues[0]?.message).toMatch(/instances/);
  });

  it('flags duplicate ids', () => {
    const design = threeTier();
    design.nodes.push(createNode('svc', 'service'));
    expect(codes(design)).toContain('DUPLICATE_ID');
  });
});
