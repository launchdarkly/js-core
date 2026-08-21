/**
 * Default time to remain on FDv1 after a fallback directive that carried no
 * usable TTL: 1 hour. This is also the upper bound of the range the server may
 * ask for; anything larger is replaced with this default.
 */
export const DEFAULT_FDV1_FALLBACK_TTL_MS = 60 * 60 * 1000;

/** Jitter is subtracted from the default TTL, up to half of it. */
const DEFAULT_TTL_JITTER_RATIO = 0.5;

/**
 * Normalizes a fallback TTL expressed in whole seconds into milliseconds.
 *
 * A TTL is only honored when it falls in the range `(0, 1 hour]`. An absent,
 * unparseable, zero, negative, or too-large TTL is replaced with the default
 * of 1 hour, minus a jitter value drawn uniformly from `[0, half the default]`
 * so that a fleet of SDKs that fell back together does not retry FDv2 in
 * lockstep. A TTL supplied by the server is already jittered by the server, so
 * it is used exactly as given. Fallback is therefore never indefinite.
 *
 * @param ttlSeconds The TTL carried by the directive, in seconds, or
 *   `undefined` when the directive carried none.
 * @param random Source of randomness for the jitter. Injectable for tests.
 */
export function resolveFallbackTtlMs(
  ttlSeconds: number | undefined,
  random: () => number = Math.random,
): number {
  const ttlMs = ttlSeconds === undefined ? undefined : ttlSeconds * 1000;
  if (
    ttlMs === undefined ||
    !Number.isFinite(ttlMs) ||
    ttlMs <= 0 ||
    ttlMs > DEFAULT_FDV1_FALLBACK_TTL_MS
  ) {
    return (
      DEFAULT_FDV1_FALLBACK_TTL_MS -
      Math.trunc(random() * DEFAULT_TTL_JITTER_RATIO * DEFAULT_FDV1_FALLBACK_TTL_MS)
    );
  }
  return ttlMs;
}

/**
 * The FDv1 fallback directive parsed from a connection's response headers or
 * from a `goodbye` message. Its presence (`fdv1Fallback === true`) means the
 * server asked the SDK to fall back to FDv1.
 *
 * `fdv1FallbackTtlMs` is how long to remain on FDv1 before retrying FDv2. It is
 * always set when `fdv1Fallback` is true: a missing, unparseable, or
 * out-of-range TTL is replaced with the jittered default, so fallback is never
 * indefinite.
 *
 * This is the single place that interprets `x-ld-fd-fallback`,
 * `x-ld-fd-fallback-ttl`, and a goodbye message's `protocolFallbackTTL`,
 * shared by the streaming and polling sources.
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
  const seconds = raw === null ? undefined : parseInt(raw, 10);

  // A missing, unparseable, or out-of-range TTL becomes the jittered default,
  // so the directive always carries a concrete deadline for retrying FDv2.
  return { fdv1Fallback: true, fdv1FallbackTtlMs: resolveFallbackTtlMs(seconds) };
}

/**
 * Reads the FDv1 fallback directive from an FDv2 `goodbye` event's data.
 *
 * SDKs that cannot read streaming response headers (e.g. browsers using the
 * native `EventSource` API) receive the fallback directive in-band via the
 * goodbye message's `protocolFallbackTTL` field. Presence of a finite numeric
 * `protocolFallbackTTL` signals FDv1 fallback; the value carries the same
 * semantics as the `x-ld-fd-fallback-ttl` header, including the replacement of
 * an out-of-range value with the jittered default. A missing, non-numeric, or
 * non-finite value is not a fallback signal and yields
 * `{ fdv1Fallback: false }`.
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

  return { fdv1Fallback: true, fdv1FallbackTtlMs: resolveFallbackTtlMs(Math.trunc(rawTtl)) };
}
