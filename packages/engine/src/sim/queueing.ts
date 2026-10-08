/** Above this many servers the exact Erlang C recursion is replaced by an approximation. */
export const EXACT_ERLANG_LIMIT = 512;

/**
 * Erlang C: probability that an arriving request has to wait in an M/M/c queue
 * with `servers` servers and offered load `a` erlangs (lambda / mu).
 */
export function erlangC(servers: number, a: number): number {
  const c = Math.max(1, Math.floor(servers));
  if (a <= 0) return 0;
  if (a >= c) return 1;
  // Erlang B via the numerically stable recursion B(k) = a*B(k-1) / (k + a*B(k-1)).
  let b = 1;
  for (let k = 1; k <= c; k++) b = (a * b) / (k + a * b);
  const rho = a / c;
  return b / (1 - rho * (1 - b));
}

/**
 * Mean time a request waits before service in an M/M/c queue (Wq), in ms.
 *
 * @param lambda arrival rate (req/s)
 * @param capacity total service rate of all servers (req/s)
 * @param servers number of parallel servers (concurrency slots)
 * @returns Infinity when the queue is unstable (lambda >= capacity)
 */
export function mmcWaitMs(lambda: number, capacity: number, servers: number): number {
  if (lambda <= 0) return 0;
  if (capacity <= 0 || lambda >= capacity) return Number.POSITIVE_INFINITY;
  const c = Math.max(1, Math.floor(servers));
  const mu = capacity / c;
  const a = lambda / mu;
  const rho = lambda / capacity;
  let waitS: number;
  if (c <= EXACT_ERLANG_LIMIT) {
    waitS = erlangC(c, a) / (capacity - lambda);
  } else {
    // Sakasegawa (1977): Lq ~= rho^sqrt(2(c+1)) / (1 - rho); Wq = Lq / lambda (Little's Law).
    const lq = Math.pow(rho, Math.sqrt(2 * (c + 1))) / (1 - rho);
    waitS = lq / lambda;
  }
  return waitS * 1000;
}

/** Little's Law: average number in system L = lambda * W. */
export function littlesLaw(lambda: number, waitMs: number): number {
  return lambda * (waitMs / 1000);
}
