/**
 * The FDv1 fallback directive parsed from a connection's response headers.
 * Its presence (`fdv1Fallback === true`) means the server asked the SDK to
 * fall back to FDv1.
 *
 * `fdv1FallbackTtlMs` is how long to remain on FDv1 before retrying FDv2:
 * - `undefined`: the server gave no TTL header (caller uses a 1-hour default).
 * - `0`: indefinite fallback (no automatic recovery).
 * - `> 0`: milliseconds to wait before attempting FDv2 recovery.
 *
 * This is the single place that interprets `x-ld-fd-fallback` and
 * `x-ld-fd-fallback-ttl`, shared by the streaming and polling sources.
 */
export interface FallbackDirective {
  fdv1Fallback: boolean;
  fdv1FallbackTtlMs?: number;
}

/**
 * Reads the FDv1 fallback directive from response headers. Returns
 * `{ fdv1Fallback: false }` when `x-ld-fd-fallback` is absent or not `"true"`.
 *
 * @param headers Header accessor. The `get` method must accept header names
 *   in any casing; both streaming and polling callers normalize to lowercase
 *   before calling this function.
 */
export function readFallbackDirective(headers: {
  get(name: string): string | null;
}): FallbackDirective {
  const fallback = headers.get('x-ld-fd-fallback');
  if (fallback === null || fallback.toLowerCase() !== 'true') {
    return { fdv1Fallback: false };
  }

  const raw = headers.get('x-ld-fd-fallback-ttl');
  if (raw === null) {
    return { fdv1Fallback: true };
  }

  const seconds = parseInt(raw, 10);
  if (Number.isNaN(seconds)) {
    return { fdv1Fallback: true };
  }

  // Clamp negative values to 0 (treated as indefinite, same as TTL=0).
  // Prevents a malicious server from sending a large-negative TTL to trigger
  // immediate recovery instead of the intended long wait.
  return { fdv1Fallback: true, fdv1FallbackTtlMs: Math.max(0, seconds) * 1000 };
}

/**
 * Reads the FDv1 fallback directive from an FDv2 `goodbye` event's data.
 *
 * SDKs that cannot read streaming response headers (e.g. browsers using the
 * native `EventSource` API) receive the fallback directive in-band via the
 * goodbye message's `protocolFallbackTTL` field (CSFDV2 §8.3.4, FDV2PL §3.7).
 * Presence of a finite numeric `protocolFallbackTTL` signals FDv1 fallback;
 * the value carries the same semantics as the `x-ld-fd-fallback-ttl` header
 * (`0` indicates indefinite fallback). A missing, non-numeric, or non-finite
 * value is not a fallback signal and yields `{ fdv1Fallback: false }`.
 *
 * @param data The raw, parsed goodbye event data (typed `unknown` because the
 *   caller has not narrowed it).
 */
export function readGoodbyeFallbackDirective(data: unknown): FallbackDirective {
  const rawTtl = (data as { protocolFallbackTTL?: unknown } | null | undefined)
    ?.protocolFallbackTTL;
  if (typeof rawTtl !== 'number' || !Number.isFinite(rawTtl)) {
    return { fdv1Fallback: false };
  }

  // Clamp negative values to 0 (treated as indefinite, same as TTL=0).
  // Prevents a malicious server from sending a large-negative TTL to trigger
  // immediate recovery instead of the intended long wait.
  return { fdv1Fallback: true, fdv1FallbackTtlMs: Math.max(0, rawTtl) * 1000 };
}
