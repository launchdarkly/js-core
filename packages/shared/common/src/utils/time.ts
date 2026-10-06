/**
 * Milliseconds from a monotonic clock when the runtime provides one.
 *
 * Deadlines and embargoes compare differences of these values. A wall clock can
 * step backward, for example through an NTP correction, and a deadline armed
 * against it would then never pass. Values from this function are not epoch
 * times and must only be compared with each other.
 *
 * Runtimes without a performance global fall back to the wall clock.
 */
// eslint-disable-next-line import/prefer-default-export
export function monotonicNow(): number {
  const perf = (globalThis as any)?.performance;
  if (perf && typeof perf.now === 'function') {
    return perf.now();
  }
  return Date.now();
}
