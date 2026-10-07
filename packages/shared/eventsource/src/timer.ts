let useWallClock: boolean | undefined;

/**
 * Milliseconds from a monotonic clock when the runtime provides one.
 *
 * The retry strategy compares differences of these values. A wall clock can step backward,
 * for example through an NTP correction, and the reset-window arithmetic would then be wrong.
 * Values from this function are not epoch times and must only be compared with each other.
 *
 * The time source is selected on the first call and never changes after that. Monotonic values
 * and wall-clock values have different origins, so a switch between sources would corrupt
 * in-flight measurements.
 *
 * @remark
 * This mirrors `monotonicNow` from `@launchdarkly/js-sdk-common`, which is the canonical copy.
 * This package stays free of a runtime dependency on that package, so the implementation is
 * duplicated instead of imported.
 */
// eslint-disable-next-line import/prefer-default-export
export function monotonicNow(): number {
  if (useWallClock === undefined) {
    const perf = (globalThis as any)?.performance;
    useWallClock = !(perf && typeof perf.now === 'function');
  }
  return useWallClock ? Date.now() : (globalThis as any).performance.now();
}
