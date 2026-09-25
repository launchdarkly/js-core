/**
 * Milliseconds from a monotonic clock when the runtime provides one.
 *
 * Deadlines and embargoes compare differences of these values. A wall clock can
 * step backward, for example through an NTP correction, and a deadline armed
 * against it would then never pass. Values from this function are not epoch
 * times and must only be compared with each other.
 *
 * TODO: this will eventually consolidate to the common package.
 */
// eslint-disable-next-line import/prefer-default-export
export function monotonicNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
