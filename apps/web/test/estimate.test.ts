import { describe, expect, it } from 'vitest';
import { estimate, formatBytes } from '../src/features/estimator/estimate';

describe('estimate', () => {
  it('turns daily users into QPS, storage and bandwidth', () => {
    const r = estimate({
      dailyActiveUsers: 86_400,
      requestsPerUserPerDay: 10,
      peakFactor: 2,
      readsPerWrite: 4,
      objectKb: 1,
      retentionYears: 1,
      replication: 3,
    });
    expect(r.avgRps).toBeCloseTo(10);
    expect(r.peakRps).toBeCloseTo(20);
    expect(r.writeRps).toBeCloseTo(2);
    expect(r.readRps).toBeCloseTo(8);
    expect(r.readRatio).toBeCloseTo(0.8);
    expect(r.storagePerDayBytes).toBeCloseTo(2 * 86_400 * 1024);
    expect(r.totalStorageBytes).toBeCloseTo(r.storagePerDayBytes * 365 * 3);
    expect(r.egressBytesPerSec).toBeCloseTo(8 * 1024);
  });

  it('formats bytes with binary units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 ** 4)).toBe('5 TB');
  });
});
