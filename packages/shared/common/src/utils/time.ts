let useWallClock: boolean | undefined;

/**
 * Milliseconds from a monotonic clock when the runtime provides one.
 *
 * Deadlines and embargoes compare differences of these values. A wall clock can
 * step backward, for example through an NTP correction, and a deadline armed
 * against it would then never pass. Values from this function are not epoch
 * times and must only be compared with each other.
 *
 * The time source is selected on the first call and never changes after that.
 * Monotonic values and wall-clock values have different origins, so a switch
 * between sources would corrupt in-flight measurements. A runtime without a
 * performance global at the first call uses the wall clock from then on, even
 * if a polyfill appears later.
 */
// eslint-disable-next-line import/prefer-default-export
export function monotonicNow(): number {
  if (useWallClock === undefined) {
    const perf = (globalThis as any)?.performance;
    useWallClock = !(perf && typeof perf.now === 'function');
  }
  return useWallClock ? Date.now() : (globalThis as any).performance.now();
}
