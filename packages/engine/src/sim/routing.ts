import type { CompiledGraph, Route } from '../model/graph';
import type { DesignNode, RequestClass } from '../model/types';
import type { NodeRuntime } from './state';
import { isKilled } from './state';

/** A target a load balancer's health checks would take out of rotation. */
export function isUnhealthy(runtime: NodeRuntime): boolean {
  return isKilled(runtime) || runtime.breaker === 'open';
}

/**
 * Outgoing routes for one class. Load balancers health-check their targets
 * and spread traffic over the healthy ones only; other nodes keep their
 * static weights (and fail if a dependency is down).
 */
export function liveRoutes(
  graph: CompiledGraph,
  runtimes: Map<string, NodeRuntime>,
  node: DesignNode,
  cls: RequestClass,
): Route[] {
  const routes = graph.routes.get(node.id)?.[cls] ?? [];
  if (node.kind !== 'loadBalancer' || routes.length < 2) return routes;
  const healthy = routes.filter((r) => !isUnhealthy(runtimes.get(r.target) as NodeRuntime));
  if (healthy.length === routes.length || healthy.length === 0) return routes;
  const total = healthy.reduce((s, r) => s + r.share, 0);
  return healthy.map((r) => ({ ...r, share: r.share / total }));
}
