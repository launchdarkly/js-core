import {
  DEFAULT_FDV1_FALLBACK_TTL_MS,
  readFallbackDirective,
  readGoodbyeFallbackDirective,
  resolveFallbackTtlMs,
} from '../../../src/datasource/fdv2/fallbackDirective';

function makeHeaders(map: Record<string, string>): { get(name: string): string | null } {
  const lower: Record<string, string> = {};
  Object.entries(map).forEach(([k, v]) => {
    lower[k.toLowerCase()] = v;
  });
  return {
    get: (name: string) => lower[name.toLowerCase()] ?? null,
  };
}

it('returns fdv1Fallback false when x-ld-fd-fallback header is absent', () => {
  const result = readFallbackDirective(makeHeaders({}));
  expect(result.fdv1Fallback).toBe(false);
  expect(result.fdv1FallbackTtlMs).toBeUndefined();
});

it('returns fdv1Fallback false when x-ld-fd-fallback is not "true"', () => {
  const result = readFallbackDirective(makeHeaders({ 'x-ld-fd-fallback': 'false' }));
  expect(result.fdv1Fallback).toBe(false);
});

it('matches "true" case-insensitively', () => {
  const result = readFallbackDirective(makeHeaders({ 'x-ld-fd-fallback': 'True' }));
  expect(result.fdv1Fallback).toBe(true);
});

it('applies the jittered default TTL when x-ld-fd-fallback-ttl is absent', () => {
  const result = readFallbackDirective(makeHeaders({ 'x-ld-fd-fallback': 'true' }));
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBeGreaterThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS / 2);
  expect(result.fdv1FallbackTtlMs).toBeLessThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('converts a TTL of "60" seconds to 60000 ms', () => {
  const result = readFallbackDirective(
    makeHeaders({ 'x-ld-fd-fallback': 'true', 'x-ld-fd-fallback-ttl': '60' }),
  );
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBe(60000);
});

it('applies the default TTL for a TTL of "0"', () => {
  const result = readFallbackDirective(
    makeHeaders({ 'x-ld-fd-fallback': 'true', 'x-ld-fd-fallback-ttl': '0' }),
  );
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBeGreaterThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS / 2);
  expect(result.fdv1FallbackTtlMs).toBeLessThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('applies the default TTL for a non-numeric x-ld-fd-fallback-ttl value', () => {
  const result = readFallbackDirective(
    makeHeaders({ 'x-ld-fd-fallback': 'true', 'x-ld-fd-fallback-ttl': 'soon' }),
  );
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBeGreaterThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS / 2);
  expect(result.fdv1FallbackTtlMs).toBeLessThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('applies the default TTL for a negative TTL', () => {
  const result = readFallbackDirective(
    makeHeaders({ 'x-ld-fd-fallback': 'true', 'x-ld-fd-fallback-ttl': '-5' }),
  );
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBeGreaterThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS / 2);
  expect(result.fdv1FallbackTtlMs).toBeLessThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('accepts a TTL of exactly one hour', () => {
  const result = readFallbackDirective(
    makeHeaders({ 'x-ld-fd-fallback': 'true', 'x-ld-fd-fallback-ttl': '3600' }),
  );
  expect(result.fdv1FallbackTtlMs).toBe(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('applies the default TTL for a TTL longer than one hour', () => {
  const result = readFallbackDirective(
    makeHeaders({ 'x-ld-fd-fallback': 'true', 'x-ld-fd-fallback-ttl': '7200' }),
  );
  expect(result.fdv1FallbackTtlMs).toBeGreaterThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS / 2);
  expect(result.fdv1FallbackTtlMs).toBeLessThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('header lookup is case-insensitive', () => {
  // Verify the makeHeaders helper lowercases keys, and readFallbackDirective
  // passes lowercase names to headers.get() as documented.
  const result = readFallbackDirective(
    makeHeaders({ 'X-LD-FD-FALLBACK': 'true', 'X-LD-FD-FALLBACK-TTL': '30' }),
  );
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBe(30000);
});

it('readGoodbyeFallbackDirective: returns fdv1Fallback false when protocolFallbackTTL is absent', () => {
  const result = readGoodbyeFallbackDirective({ reason: 'bye' });
  expect(result.fdv1Fallback).toBe(false);
  expect(result.fdv1FallbackTtlMs).toBeUndefined();
});

it('readGoodbyeFallbackDirective: returns fdv1Fallback false when data is null', () => {
  const result = readGoodbyeFallbackDirective(null);
  expect(result.fdv1Fallback).toBe(false);
  expect(result.fdv1FallbackTtlMs).toBeUndefined();
});

it('readGoodbyeFallbackDirective: returns fdv1Fallback false when data is undefined', () => {
  const result = readGoodbyeFallbackDirective(undefined);
  expect(result.fdv1Fallback).toBe(false);
  expect(result.fdv1FallbackTtlMs).toBeUndefined();
});

it('readGoodbyeFallbackDirective: converts a protocolFallbackTTL of 60 seconds to 60000 ms', () => {
  const result = readGoodbyeFallbackDirective({ reason: 'falling back', protocolFallbackTTL: 60 });
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBe(60000);
});

it('readGoodbyeFallbackDirective: applies the default TTL for a protocolFallbackTTL of 0', () => {
  const result = readGoodbyeFallbackDirective({ reason: 'falling back', protocolFallbackTTL: 0 });
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBeGreaterThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS / 2);
  expect(result.fdv1FallbackTtlMs).toBeLessThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('readGoodbyeFallbackDirective: applies the default TTL for a negative protocolFallbackTTL', () => {
  const result = readGoodbyeFallbackDirective({ reason: 'falling back', protocolFallbackTTL: -5 });
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBeGreaterThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS / 2);
  expect(result.fdv1FallbackTtlMs).toBeLessThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('readGoodbyeFallbackDirective: accepts a protocolFallbackTTL of exactly one hour', () => {
  const result = readGoodbyeFallbackDirective({
    reason: 'falling back',
    protocolFallbackTTL: 3600,
  });
  expect(result.fdv1FallbackTtlMs).toBe(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('readGoodbyeFallbackDirective: applies the default TTL for a protocolFallbackTTL over one hour', () => {
  const result = readGoodbyeFallbackDirective({
    reason: 'falling back',
    protocolFallbackTTL: 7200,
  });
  expect(result.fdv1FallbackTtlMs).toBeGreaterThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS / 2);
  expect(result.fdv1FallbackTtlMs).toBeLessThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('readGoodbyeFallbackDirective: truncates a fractional protocolFallbackTTL to whole seconds before the range check', () => {
  const result = readGoodbyeFallbackDirective({ reason: 'falling back', protocolFallbackTTL: 0.001 });
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBeGreaterThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS / 2);
  expect(result.fdv1FallbackTtlMs).toBeLessThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('readGoodbyeFallbackDirective: returns fdv1Fallback false for a non-numeric protocolFallbackTTL', () => {
  const result = readGoodbyeFallbackDirective({
    reason: 'falling back',
    protocolFallbackTTL: 'soon',
  });
  expect(result.fdv1Fallback).toBe(false);
  expect(result.fdv1FallbackTtlMs).toBeUndefined();
});

it('readGoodbyeFallbackDirective: returns fdv1Fallback false for a non-finite protocolFallbackTTL', () => {
  const result = readGoodbyeFallbackDirective({
    reason: 'falling back',
    protocolFallbackTTL: Infinity,
  });
  expect(result.fdv1Fallback).toBe(false);
  expect(result.fdv1FallbackTtlMs).toBeUndefined();
});

it('resolveFallbackTtlMs: converts a whole number of seconds to milliseconds without jitter', () => {
  expect(resolveFallbackTtlMs(60, () => 1)).toBe(60000);
});

it('resolveFallbackTtlMs: accepts a TTL of exactly one hour unchanged', () => {
  expect(resolveFallbackTtlMs(3600, () => 1)).toBe(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('resolveFallbackTtlMs: uses the default for a TTL greater than one hour', () => {
  expect(resolveFallbackTtlMs(3601, () => 0)).toBe(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('resolveFallbackTtlMs: uses the default for a TTL of zero', () => {
  expect(resolveFallbackTtlMs(0, () => 0)).toBe(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('resolveFallbackTtlMs: uses the default for a negative TTL', () => {
  expect(resolveFallbackTtlMs(-5, () => 0)).toBe(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('resolveFallbackTtlMs: uses the default for an absent TTL', () => {
  expect(resolveFallbackTtlMs(undefined, () => 0)).toBe(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('resolveFallbackTtlMs: uses the default for a TTL that is not a number', () => {
  expect(resolveFallbackTtlMs(NaN, () => 0)).toBe(DEFAULT_FDV1_FALLBACK_TTL_MS);
});

it('resolveFallbackTtlMs: subtracts jitter of up to half the default TTL', () => {
  expect(resolveFallbackTtlMs(undefined, () => 0.5)).toBe(DEFAULT_FDV1_FALLBACK_TTL_MS * 0.75);
  expect(resolveFallbackTtlMs(undefined, () => 1)).toBe(DEFAULT_FDV1_FALLBACK_TTL_MS / 2);
});

it('resolveFallbackTtlMs: defaults to Math.random for jitter and stays within bounds', () => {
  for (let i = 0; i < 50; i += 1) {
    const ttl = resolveFallbackTtlMs(undefined);
    expect(ttl).toBeGreaterThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS / 2);
    expect(ttl).toBeLessThanOrEqual(DEFAULT_FDV1_FALLBACK_TTL_MS);
  }
});
