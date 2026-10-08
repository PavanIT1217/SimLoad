import { fitFromPercentile, fitLognormal } from '@syssim/engine';
import type { LatencyFit } from '@syssim/engine';
import { parseLatencyCsv } from './csv';

export type LoadTestFormat = 'k6-summary' | 'k6-json' | 'gatling' | 'csv';

export interface LoadTestImport {
  format: LoadTestFormat;
  fit: LatencyFit;
  /** Raw samples when the file contained them (empty for summaries). */
  samples: number[];
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** k6 `--summary-export` / handleSummary JSON: percentiles of http_req_duration. */
function parseK6Summary(data: Json): LatencyFit | null {
  const metrics = isObject(data.metrics) ? data.metrics : null;
  const duration =
    metrics && isObject(metrics.http_req_duration) ? metrics.http_req_duration : null;
  if (!duration) return null;
  const values = isObject(duration.values) ? duration.values : duration;
  const median = num(values.med) ?? num(values['p(50)']);
  if (median === undefined) return null;
  for (const p of [99, 95, 90] as const) {
    const v = num(values[`p(${p})`]);
    if (v !== undefined && v >= median) return fitFromPercentile(median, p, v);
  }
  return null;
}

/** k6 `--out json` NDJSON: one Point per request. */
function parseK6Points(text: string): number[] {
  const samples: number[] = [];
  for (const line of text.split('\n')) {
    if (!line.includes('"http_req_duration"') || !line.includes('"Point"')) continue;
    try {
      const row = JSON.parse(line) as Json;
      const value = isObject(row.data) ? num(row.data.value) : undefined;
      if (value !== undefined) samples.push(value);
    } catch {
      // Skip malformed lines.
    }
  }
  return samples;
}

/** Gatling simulation.log: REQUEST rows carry start and end epoch-millisecond timestamps. */
function parseGatling(text: string): number[] {
  const samples: number[] = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('REQUEST')) continue;
    const stamps = line
      .split('\t')
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 1e12);
    const [start, end] = stamps.slice(-2);
    if (start !== undefined && end !== undefined && end >= start) samples.push(end - start);
  }
  return samples;
}

/**
 * Detects the load-test format and fits a lognormal latency model. JMeter
 * JTL files and generic CSVs go through the CSV path ("elapsed" column).
 */
export function importLoadTest(text: string): LoadTestImport {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) {
    const k6Points = parseK6Points(text);
    if (k6Points.length >= 2)
      return { format: 'k6-json', fit: fitLognormal(k6Points), samples: k6Points };
    try {
      const fit = parseK6Summary(JSON.parse(text) as Json);
      if (fit) return { format: 'k6-summary', fit, samples: [] };
    } catch {
      // Fall through to the error below.
    }
    throw new RangeError('JSON file has no k6 http_req_duration data');
  }
  if (trimmed.startsWith('RUN') || /^REQUEST\t/m.test(text)) {
    const samples = parseGatling(text);
    return { format: 'gatling', fit: fitLognormal(samples), samples };
  }
  const samples = parseLatencyCsv(text);
  return { format: 'csv', fit: fitLognormal(samples), samples };
}

export const FORMAT_LABELS: Record<LoadTestFormat, string> = {
  'k6-summary': 'k6 summary',
  'k6-json': 'k6 JSON output',
  gatling: 'Gatling simulation.log',
  csv: 'CSV / JMeter JTL',
};
