/**
 * Calculates how long to wait before the next poll, based on when data was
 * last received (the freshness timestamp).
 *
 * - If `freshness` is `undefined` (no data, cache miss, or attribute change),
 *   returns 0 — poll immediately (per Req 5.2.4).
 * - Otherwise returns `max(0, pollIntervalMs - (now - freshness))`.
 *
 * @param freshness Timestamp (ms since epoch) when data was last received,
 *   or `undefined` if stale/unknown.
 * @param pollIntervalMs The configured polling interval in milliseconds.
 * @param now The current time in milliseconds since epoch.
 * @returns The number of milliseconds to wait before the next poll.
 *
 * @internal
 */
export function calculatePollDelay(
  freshness: number | undefined,
  pollIntervalMs: number,
  now: number,
): number {
  if (freshness === undefined) {
    return 0;
  }
  const elapsed = now - freshness;
  // Clamp to [0, pollIntervalMs] to guard against future timestamps
  // (e.g., clock skew or corrupt data).
  return Math.max(0, Math.min(pollIntervalMs, pollIntervalMs - elapsed));
}
