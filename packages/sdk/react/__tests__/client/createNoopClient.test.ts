import { createNoopClient } from '../../src/client/createNoopClient';

// Ensure we're in an SSR-like environment (no window).
const originalWindow = global.window;
beforeAll(() => {
  // @ts-ignore
  delete global.window;
});
afterAll(() => {
  // @ts-ignore
  global.window = originalWindow;
});

const bootstrapData = {
  'bool-flag': true,
  'number-flag': 42,
  'string-flag': 'hello',
  'json-flag': { nested: true },
  'null-flag': null,
  $flagsState: {
    'bool-flag': { variation: 0, version: 5 },
    'number-flag': { variation: 1, version: 3 },
    'string-flag': { variation: 2, version: 7 },
    'json-flag': { variation: 0, version: 1 },
    'null-flag': { variation: 1, version: 2 },
  },
  $valid: true,
};

describe('given bootstrap data', () => {
  const client = createNoopClient(bootstrapData);

  it('returns boolean value when key exists and type matches', () => {
    expect(client.boolVariation('bool-flag', false)).toBe(true);
  });

  it('returns default when boolean key exists but type mismatches', () => {
    expect(client.boolVariation('string-flag', false)).toBe(false);
  });

  it('returns default when boolean key is missing', () => {
    expect(client.boolVariation('missing', true)).toBe(true);
  });

  it('returns number value when key exists and type matches', () => {
    expect(client.numberVariation('number-flag', 0)).toBe(42);
  });

  it('returns default when number key exists but type mismatches', () => {
    expect(client.numberVariation('bool-flag', 99)).toBe(99);
  });

  it('returns default when number key is missing', () => {
    expect(client.numberVariation('missing', 7)).toBe(7);
  });

  it('returns string value when key exists and type matches', () => {
    expect(client.stringVariation('string-flag', 'fallback')).toBe('hello');
  });

  it('returns default when string key exists but type mismatches', () => {
    expect(client.stringVariation('number-flag', 'fallback')).toBe('fallback');
  });

  it('returns default when string key is missing', () => {
    expect(client.stringVariation('missing', 'fallback')).toBe('fallback');
  });

  it('returns json value when key exists', () => {
    expect(client.jsonVariation('json-flag', null)).toEqual({ nested: true });
  });

  it('returns json value even for null', () => {
    expect(client.jsonVariation('null-flag', 'default')).toBeNull();
  });

  it('returns default when json key is missing', () => {
    expect(client.jsonVariation('missing', 'default')).toBe('default');
  });
});

describe('detail variants return null variationIndex and reason', () => {
  const client = createNoopClient(bootstrapData);

  it('returns value with null variationIndex and reason for boolVariationDetail', () => {
    const detail = client.boolVariationDetail('bool-flag', false);
    expect(detail.value).toBe(true);
    expect(detail.variationIndex).toBeNull();
    expect(detail.reason).toBeNull();
  });

  it('returns value with null variationIndex and reason for numberVariationDetail', () => {
    const detail = client.numberVariationDetail('number-flag', 0);
    expect(detail.value).toBe(42);
    expect(detail.variationIndex).toBeNull();
    expect(detail.reason).toBeNull();
  });

  it('returns value with null variationIndex and reason for stringVariationDetail', () => {
    const detail = client.stringVariationDetail('string-flag', 'fallback');
    expect(detail.value).toBe('hello');
    expect(detail.variationIndex).toBeNull();
    expect(detail.reason).toBeNull();
  });

  it('returns value with null variationIndex and reason for jsonVariationDetail', () => {
    const detail = client.jsonVariationDetail('json-flag', null);
    expect(detail.value).toEqual({ nested: true });
    expect(detail.variationIndex).toBeNull();
    expect(detail.reason).toBeNull();
  });

  it('returns default value with null variationIndex for missing key', () => {
    const detail = client.boolVariationDetail('missing', false);
    expect(detail.value).toBe(false);
    expect(detail.variationIndex).toBeNull();
    expect(detail.reason).toBeNull();
  });

  it('returns default value in detail when type mismatches', () => {
    const detail = client.boolVariationDetail('string-flag', false);
    expect(detail.value).toBe(false);
    expect(detail.variationIndex).toBeNull();
    expect(detail.reason).toBeNull();
  });
});

describe('allFlags returns non-$ keys only', () => {
  const client = createNoopClient(bootstrapData);

  it('excludes $flagsState and $valid', () => {
    const flags = client.allFlags();
    expect(flags).toEqual({
      'bool-flag': true,
      'number-flag': 42,
      'string-flag': 'hello',
      'json-flag': { nested: true },
      'null-flag': null,
    });
  });

  it('returns a copy, not a reference', () => {
    const flags1 = client.allFlags();
    const flags2 = client.allFlags();
    expect(flags1).not.toBe(flags2);
  });
});

describe('stubbed LDClient methods', () => {
  const client = createNoopClient(bootstrapData);

  it('close resolves immediately', async () => {
    await expect(client.close()).resolves.toBeUndefined();
  });

  it('flush resolves immediately', async () => {
    await expect(client.flush()).resolves.toBeUndefined();
  });

  it('identify resolves immediately', async () => {
    await expect(client.identify({ kind: 'user', key: 'test' })).resolves.toBeUndefined();
  });

  it('track does not throw', () => {
    expect(() => client.track('event-key', undefined)).not.toThrow();
  });

  it('variation returns value from bootstrap', () => {
    expect(client.variation('bool-flag', false)).toBe(true);
  });

  it('variation returns default for missing key', () => {
    expect(client.variation('missing', 'default')).toBe('default');
  });

  it('variationDetail returns value with null variationIndex and reason', () => {
    const detail = client.variationDetail('bool-flag', false);
    expect(detail.value).toBe(true);
    expect(detail.variationIndex).toBeNull();
    expect(detail.reason).toBeNull();
  });

  it('waitForInitialization resolves immediately', async () => {
    await expect(client.waitForInitialization()).resolves.toBeUndefined();
  });
});

describe('handles edge cases gracefully', () => {
  it('handles undefined bootstrap', () => {
    const client = createNoopClient(undefined);
    expect(client.stringVariation('any', 'def')).toBe('def');
    expect(client.allFlags()).toEqual({});
  });

  it('handles no bootstrap argument', () => {
    const client = createNoopClient();
    expect(client.stringVariation('any', 'def')).toBe('def');
    expect(client.allFlags()).toEqual({});
  });

  it('handles bootstrap missing $flagsState', () => {
    const client = createNoopClient({ 'my-flag': true });
    expect(client.boolVariation('my-flag', false)).toBe(true);

    const detail = client.boolVariationDetail('my-flag', false);
    expect(detail.value).toBe(true);
    expect(detail.variationIndex).toBeNull();
  });

  it('always reports initialization state as initializing', () => {
    expect(createNoopClient({}).getInitializationState()).toBe('initializing');
    expect(createNoopClient({ 'my-flag': true }).getInitializationState()).toBe('initializing');
    expect(createNoopClient().getInitializationState()).toBe('initializing');
  });

 it('isReady returns true when bootstrap is provided', () => {
    const client = createNoopClient({});
    expect(client.isReady()).toBe(true);
  });

  it('isReady returns false when bootstrap is not provided', () => {
    const client = createNoopClient();
    expect(client.isReady()).toBe(false);
  });
});

describe('event and lifecycle stubs do not throw and return expected values', () => {
  const client = createNoopClient(bootstrapData);

  it('getContext returns undefined', () => {
    expect(client.getContext()).toBeUndefined();
  });

  it('shouldUseCamelCaseFlagKeys returns true', () => {
    expect(client.shouldUseCamelCaseFlagKeys()).toBe(true);
  });

  it('on does not throw', () => {
    expect(() => client.on('change:bool-flag', () => {})).not.toThrow();
  });

  it('off does not throw', () => {
    expect(() => client.off('change:bool-flag', () => {})).not.toThrow();
  });

  it('onContextChange returns a callable unsubscribe function', () => {
    const unsubscribe = client.onContextChange(() => {});
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it('onInitializationStatusChange returns a callable unsubscribe function', () => {
    const unsubscribe = client.onInitializationStatusChange(() => {});
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it('start does not throw', () => {
    expect(() => client.start()).not.toThrow();
  });

  it('addHook does not throw', () => {
    expect(() => client.addHook({} as any)).not.toThrow();
  });

  it('setStreaming does not throw', () => {
    expect(() => client.setStreaming(true)).not.toThrow();
  });
});
