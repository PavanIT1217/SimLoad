import { reachableFromClients, topologicalOrder } from './graph';
import type { Design, DesignNode, ValidationIssue } from './types';

function configIssues(node: DesignNode): string[] {
  const c = node.config;
  const problems: string[] = [];
  const nonNegative: [string, number][] = [
    ['capacityRps', c.capacityRps],
    ['baseLatencyMs', c.baseLatencyMs],
    ['latencySigma', c.latencySigma],
    ['maxQueue', c.maxQueue],
    ['timeoutMs', c.timeoutMs],
    ['retries', c.retries],
    ['replicas', c.replicas],
    ['consumerRps', c.consumerRps],
    ['retryBackoffMs', c.retryBackoffMs],
    ['rateLimitRps', c.rateLimitRps],
    ['coldStartMs', c.coldStartMs],
    ['costPerHour', c.costPerHour],
    ['costPerMillion', c.costPerMillion],
  ];
  for (const [name, value] of nonNegative) {
    if (!Number.isFinite(value) || value < 0) problems.push(`${name} must be >= 0`);
  }
  if (!Number.isFinite(c.instances) || c.instances < 1) problems.push('instances must be >= 1');
  if (!Number.isFinite(c.maxConcurrency) || c.maxConcurrency < 1) {
    problems.push('maxConcurrency must be >= 1');
  }
  const fractions: [string, number][] = [
    ['hitRatio', c.hitRatio],
    ['hotKeySkew', c.hotKeySkew],
    ['retryBudget', c.retryBudget],
    ['circuitBreaker.errorThreshold', c.circuitBreaker.errorThreshold],
  ];
  for (const [name, value] of fractions) {
    if (!(value >= 0 && value <= 1)) problems.push(`${name} must be within 0..1`);
  }
  if (!Number.isFinite(c.shards) || c.shards < 1) problems.push('shards must be >= 1');
  if (node.kind !== 'client' && node.kind !== 'queue' && c.capacityRps <= 0) {
    problems.push('capacityRps must be > 0');
  }
  return problems;
}

/**
 * Checks a design for structural problems. Errors make the design
 * unsimulatable; warnings are surfaced to the user but tolerated.
 */
export function validateDesign(design: Design): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  for (const node of design.nodes) {
    if (ids.has(node.id)) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_ID',
        message: `Duplicate node id "${node.id}"`,
        nodeIds: [node.id],
      });
    }
    ids.add(node.id);
    const problems = configIssues(node);
    if (problems.length > 0) {
      issues.push({
        severity: 'error',
        code: 'INVALID_CONFIG',
        message: `${node.label}: ${problems.join(', ')}`,
        nodeIds: [node.id],
      });
    }
  }

  for (const edge of design.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      issues.push({
        severity: 'error',
        code: 'DANGLING_EDGE',
        message: `Edge "${edge.id}" references a missing node`,
        edgeIds: [edge.id],
      });
    } else if (edge.source === edge.target) {
      issues.push({
        severity: 'error',
        code: 'SELF_LOOP',
        message: `Edge "${edge.id}" connects a node to itself`,
        edgeIds: [edge.id],
      });
    }
    if (!(edge.weight > 0)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_CONFIG',
        message: `Edge "${edge.id}" must have a positive weight`,
        edgeIds: [edge.id],
      });
    }
  }

  const clients = design.nodes.filter((n) => n.kind === 'client');
  if (clients.length === 0) {
    issues.push({ severity: 'error', code: 'NO_CLIENT', message: 'Add a Client to send traffic' });
  }
  for (const client of clients) {
    if (design.edges.some((e) => e.target === client.id)) {
      issues.push({
        severity: 'warning',
        code: 'CLIENT_HAS_INPUT',
        message: `${client.label} is a traffic source and ignores incoming edges`,
        nodeIds: [client.id],
      });
    }
  }

  if (topologicalOrder(design) === null) {
    const inCycle = findCycleNodes(design);
    issues.push({
      severity: 'error',
      code: 'CYCLE',
      message: 'The design contains a cycle; request flow must be acyclic',
      nodeIds: inCycle,
    });
  }

  const reachable = reachableFromClients(design);
  const unreachable = design.nodes.filter((n) => !reachable.has(n.id)).map((n) => n.id);
  if (clients.length > 0 && unreachable.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'UNREACHABLE',
      message: `${unreachable.length} node(s) receive no traffic from any client`,
      nodeIds: unreachable,
    });
  }
  return issues;
}

/** Nodes left over after repeatedly removing sources and sinks lie on cycles. */
function findCycleNodes(design: Design): string[] {
  const remaining = new Set(design.nodes.map((n) => n.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...remaining]) {
      const edges = design.edges.filter((e) => remaining.has(e.source) && remaining.has(e.target));
      const hasIn = edges.some((e) => e.target === id);
      const hasOut = edges.some((e) => e.source === id);
      if (!hasIn || !hasOut) {
        remaining.delete(id);
        changed = true;
      }
    }
  }
  return [...remaining];
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
