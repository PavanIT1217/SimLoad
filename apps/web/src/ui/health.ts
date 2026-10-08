export type Health = 'idle' | 'ok' | 'warn' | 'bad' | 'dead';

/** Traffic-light health from saturation (offered / capacity) and backlog. */
export function healthOf(saturation: number, queueDepth: number, failed: boolean): Health {
  if (failed) return 'dead';
  if (saturation >= 0.9 || queueDepth > 1) return 'bad';
  if (saturation >= 0.7) return 'warn';
  if (saturation > 0) return 'ok';
  return 'idle';
}

export const HEALTH_LABEL: Record<Health, string> = {
  idle: 'Idle',
  ok: 'Healthy',
  warn: 'Busy',
  bad: 'Overloaded',
  dead: 'Down',
};
