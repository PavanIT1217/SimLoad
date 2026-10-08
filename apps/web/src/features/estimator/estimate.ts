/** Inputs for a classic interview-style capacity estimate. */
export interface EstimateInput {
  dailyActiveUsers: number;
  requestsPerUserPerDay: number;
  /** Peak-to-average traffic ratio. */
  peakFactor: number;
  readsPerWrite: number;
  /** Average payload size in KB (stored per write, transferred per read). */
  objectKb: number;
  retentionYears: number;
  /** Copies kept of every object (replication factor). */
  replication: number;
}

export interface EstimateResult {
  avgRps: number;
  peakRps: number;
  readRps: number;
  writeRps: number;
  readRatio: number;
  /** Bytes of new data per day (before replication). */
  storagePerDayBytes: number;
  /** Bytes stored after retention and replication. */
  totalStorageBytes: number;
  /** Average and peak bytes/s served to readers. */
  egressBytesPerSec: number;
  peakEgressBytesPerSec: number;
  ingressBytesPerSec: number;
}

export const SECONDS_PER_DAY = 86_400;
const KB = 1024;

export const DEFAULT_ESTIMATE: EstimateInput = {
  dailyActiveUsers: 10_000_000,
  requestsPerUserPerDay: 20,
  peakFactor: 3,
  readsPerWrite: 10,
  objectKb: 2,
  retentionYears: 5,
  replication: 3,
};

/** Back-of-the-envelope QPS, storage and bandwidth from usage assumptions. */
export function estimate(input: EstimateInput): EstimateResult {
  const avgRps = (input.dailyActiveUsers * input.requestsPerUserPerDay) / SECONDS_PER_DAY;
  const readRatio = input.readsPerWrite / (1 + input.readsPerWrite);
  const writeRps = avgRps * (1 - readRatio);
  const readRps = avgRps - writeRps;
  const objectBytes = input.objectKb * KB;
  const storagePerDayBytes = writeRps * SECONDS_PER_DAY * objectBytes;
  return {
    avgRps,
    peakRps: avgRps * input.peakFactor,
    readRps,
    writeRps,
    readRatio,
    storagePerDayBytes,
    totalStorageBytes: storagePerDayBytes * 365 * input.retentionYears * input.replication,
    egressBytesPerSec: readRps * objectBytes,
    peakEgressBytesPerSec: readRps * input.peakFactor * objectBytes,
    ingressBytesPerSec: writeRps * objectBytes,
  };
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 100 ? Math.round(value) : +value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}
