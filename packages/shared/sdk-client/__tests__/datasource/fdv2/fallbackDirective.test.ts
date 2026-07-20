import {
  readFallbackDirective,
  readGoodbyeFallbackDirective,
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

it('returns fdv1Fallback true with undefined TTL when x-ld-fd-fallback-ttl is absent', () => {
  const result = readFallbackDirective(makeHeaders({ 'x-ld-fd-fallback': 'true' }));
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBeUndefined();
});

it('converts a TTL of "60" seconds to 60000 ms', () => {
  const result = readFallbackDirective(
    makeHeaders({ 'x-ld-fd-fallback': 'true', 'x-ld-fd-fallback-ttl': '60' }),
  );
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBe(60000);
});

it('converts TTL "0" to 0 ms (indefinite fallback)', () => {
  const result = readFallbackDirective(
    makeHeaders({ 'x-ld-fd-fallback': 'true', 'x-ld-fd-fallback-ttl': '0' }),
  );
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBe(0);
});

it('returns undefined TTL for a non-numeric x-ld-fd-fallback-ttl value', () => {
  const result = readFallbackDirective(
    makeHeaders({ 'x-ld-fd-fallback': 'true', 'x-ld-fd-fallback-ttl': 'soon' }),
  );
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBeUndefined();
});

it('clamps negative TTL seconds to 0 ms (treated as indefinite)', () => {
  const result = readFallbackDirective(
    makeHeaders({ 'x-ld-fd-fallback': 'true', 'x-ld-fd-fallback-ttl': '-5' }),
  );
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBe(0);
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

it('readGoodbyeFallbackDirective: converts protocolFallbackTTL 0 to 0 ms (indefinite fallback)', () => {
  const result = readGoodbyeFallbackDirective({ reason: 'falling back', protocolFallbackTTL: 0 });
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBe(0);
});

it('readGoodbyeFallbackDirective: clamps negative protocolFallbackTTL to 0 ms', () => {
  const result = readGoodbyeFallbackDirective({ reason: 'falling back', protocolFallbackTTL: -5 });
  expect(result.fdv1Fallback).toBe(true);
  expect(result.fdv1FallbackTtlMs).toBe(0);
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
