import { COMPONENT_KINDS, DEFAULT_TRAFFIC, TRAFFIC_PROFILES, defaultConfig } from '@simload/engine';
import type {
  ComponentKind,
  Design,
  DesignEdge,
  DesignNode,
  NodeConfig,
  TrafficSettings,
} from '@simload/engine';

export class DesignParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignParseError';
  }
}

type Json = Record<string, unknown>;
type NumericKey = Exclude<keyof NodeConfig, 'autoscale' | 'circuitBreaker'>;
const NESTED = new Set(['autoscale', 'circuitBreaker']);

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function parseConfig(kind: ComponentKind, raw: unknown): NodeConfig {
  const defaults = defaultConfig(kind);
  if (!isObject(raw)) return defaults;
  const autoscale = isObject(raw.autoscale) ? raw.autoscale : {};
  const breaker = isObject(raw.circuitBreaker) ? raw.circuitBreaker : {};
  const config = { ...defaults };
  const numericKeys = Object.keys(defaults).filter((k) => !NESTED.has(k)) as NumericKey[];
  for (const key of numericKeys) config[key] = num(raw[key], defaults[key]);
  config.autoscale = {
    enabled:
      typeof autoscale.enabled === 'boolean' ? autoscale.enabled : defaults.autoscale.enabled,
    delayMs: num(autoscale.delayMs, defaults.autoscale.delayMs),
    minInstances: num(autoscale.minInstances, defaults.autoscale.minInstances),
    maxInstances: num(autoscale.maxInstances, defaults.autoscale.maxInstances),
    targetUtilization: num(autoscale.targetUtilization, defaults.autoscale.targetUtilization),
  };
  config.circuitBreaker = {
    enabled:
      typeof breaker.enabled === 'boolean' ? breaker.enabled : defaults.circuitBreaker.enabled,
    errorThreshold: num(breaker.errorThreshold, defaults.circuitBreaker.errorThreshold),
    openMs: num(breaker.openMs, defaults.circuitBreaker.openMs),
  };
  return config;
}

function parseNode(raw: unknown, index: number): DesignNode {
  if (!isObject(raw)) throw new DesignParseError(`Node #${index + 1} is not an object`);
  const kind = raw.kind as ComponentKind;
  if (!COMPONENT_KINDS.includes(kind)) {
    throw new DesignParseError(`Node #${index + 1} has unknown kind "${String(raw.kind)}"`);
  }
  if (typeof raw.id !== 'string' || raw.id === '') {
    throw new DesignParseError(`Node #${index + 1} is missing an id`);
  }
  const position = isObject(raw.position) ? raw.position : {};
  return {
    id: raw.id,
    kind,
    label: str(raw.label, raw.id),
    position: { x: num(position.x, 0), y: num(position.y, 0) },
    config: parseConfig(kind, raw.config),
    ...(typeof raw.zone === 'string' && raw.zone !== '' ? { zone: raw.zone } : {}),
  };
}

function parseEdge(raw: unknown, index: number): DesignEdge {
  if (!isObject(raw) || typeof raw.source !== 'string' || typeof raw.target !== 'string') {
    throw new DesignParseError(`Edge #${index + 1} needs a source and target`);
  }
  return {
    id: str(raw.id, `${raw.source}->${raw.target}`),
    source: raw.source,
    target: raw.target,
    weight: num(raw.weight, 1),
    traffic: raw.traffic === 'read' || raw.traffic === 'write' ? raw.traffic : 'all',
  };
}

function parseTraffic(raw: unknown): TrafficSettings {
  if (!isObject(raw)) return { ...DEFAULT_TRAFFIC };
  const profile = TRAFFIC_PROFILES.find((p) => p === raw.profile) ?? DEFAULT_TRAFFIC.profile;
  return {
    peakRps: num(raw.peakRps, DEFAULT_TRAFFIC.peakRps),
    profile,
    readRatio: Math.min(1, Math.max(0, num(raw.readRatio, DEFAULT_TRAFFIC.readRatio))),
  };
}

/**
 * Turns untrusted JSON (imports, share links, autosave) into a Design.
 * Missing config fields fall back to the component defaults so older files keep loading.
 */
export function parseDesign(input: unknown): Design {
  if (!isObject(input)) throw new DesignParseError('Design must be a JSON object');
  if (input.version !== undefined && input.version !== 1) {
    throw new DesignParseError(`Unsupported design version ${String(input.version)}`);
  }
  if (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) {
    throw new DesignParseError('Design must contain "nodes" and "edges" arrays');
  }
  return {
    version: 1,
    name: str(input.name, 'Imported design'),
    nodes: input.nodes.map(parseNode),
    edges: input.edges.map(parseEdge),
    traffic: parseTraffic(input.traffic),
  };
}

export function parseDesignJson(text: string): Design {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new DesignParseError('File is not valid JSON');
  }
  return parseDesign(data);
}
