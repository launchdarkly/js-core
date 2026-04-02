import type { LDDebugOverride } from '@launchdarkly/js-client-sdk-common';

import TestData from '../src/TestData';

function createMockDebugOverride(): LDDebugOverride & {
  overrides: Record<string, unknown>;
} {
  const overrides: Record<string, unknown> = {};
  return {
    overrides,
    setOverride: jest.fn((key: string, value: unknown) => {
      overrides[key] = value;
    }),
    removeOverride: jest.fn((key: string) => {
      delete overrides[key];
    }),
    clearAllOverrides: jest.fn(() => {
      Object.keys(overrides).forEach((k) => delete overrides[k]);
    }),
    getAllOverrides: jest.fn(() => ({})),
  };
}

describe('TestData', () => {
  it('returns a default boolean flag builder for new keys', () => {
    const td = new TestData();
    expect(td.flag('new-flag').resolve()).toBe(true);
  });

  it('returns a clone of the existing builder after update', () => {
    const td = new TestData();
    td.update(td.flag('my-flag').booleanFlag().variationForAll(false));

    expect(td.flag('my-flag').resolve()).toBe(false);
  });

  it('does not affect stored state when builder is modified after update', () => {
    const td = new TestData();
    const builder = td.flag('my-flag').booleanFlag().variationForAll(true);
    td.update(builder);

    builder.variationForAll(false);

    expect(td.flag('my-flag').resolve()).toBe(true);
  });

  it('applies overrides when registerDebug is called', () => {
    const td = new TestData();
    td.update(td.flag('flag-a').booleanFlag().variationForAll(true));
    td.update(td.flag('flag-b').valueForAll('hello'));

    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    expect(debugOverride.setOverride).toHaveBeenCalledWith('flag-a', true);
    expect(debugOverride.setOverride).toHaveBeenCalledWith('flag-b', 'hello');
    expect(debugOverride.overrides['flag-a']).toBe(true);
    expect(debugOverride.overrides['flag-b']).toBe('hello');
  });

  it('propagates updates via debugOverride after registration', () => {
    const td = new TestData();
    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    td.update(td.flag('my-flag').booleanFlag().variationForAll(true));

    expect(debugOverride.setOverride).toHaveBeenCalledWith('my-flag', true);
    expect(debugOverride.overrides['my-flag']).toBe(true);

    td.update(td.flag('my-flag').variationForAll(false));

    expect(debugOverride.setOverride).toHaveBeenCalledWith('my-flag', false);
    expect(debugOverride.overrides['my-flag']).toBe(false);
  });

  it('queues updates before registerDebug is called', () => {
    const td = new TestData();
    td.update(td.flag('early-flag').booleanFlag().variationForAll(true));

    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    expect(debugOverride.overrides['early-flag']).toBe(true);
  });

  it('returns correct plugin metadata', () => {
    const td = new TestData();
    expect(td.getMetadata()).toEqual({ name: 'test-data' });
  });

  it('register is a no-op', () => {
    const td = new TestData();
    expect(() =>
      td.register(undefined, {
        sdk: { name: 'test', version: '0.0.0' },
        clientSideId: 'test-key',
      } as never),
    ).not.toThrow();
  });

  it('handles multiple flag updates correctly', () => {
    const td = new TestData();
    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    td.update(td.flag('flag-1').booleanFlag().variationForAll(true));
    td.update(td.flag('flag-2').valueForAll('red'));
    td.update(td.flag('flag-3').variations(1, 2, 3).on(true).fallthroughVariation(2));

    expect(debugOverride.overrides['flag-1']).toBe(true);
    expect(debugOverride.overrides['flag-2']).toBe('red');
    expect(debugOverride.overrides['flag-3']).toBe(3);
  });

  it('skips setOverride when update produces the same primitive value', () => {
    const td = new TestData();
    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    td.update(td.flag('flag').booleanFlag().variationForAll(true));
    expect(debugOverride.setOverride).toHaveBeenCalledTimes(1);

    td.update(td.flag('flag').booleanFlag().variationForAll(true));
    expect(debugOverride.setOverride).toHaveBeenCalledTimes(1);

    td.update(td.flag('flag').booleanFlag().variationForAll(false));
    expect(debugOverride.setOverride).toHaveBeenCalledTimes(2);
  });

  it('always propagates object/array values so in-place mutations are not lost', () => {
    const td = new TestData();
    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    const cfg = { showBanner: true };
    td.update(td.flag('cfg').valueForAll(cfg));
    expect(debugOverride.setOverride).toHaveBeenCalledTimes(1);

    cfg.showBanner = false;
    td.update(td.flag('cfg').valueForAll(cfg));
    expect(debugOverride.setOverride).toHaveBeenCalledTimes(2);
  });

  it('removeFlag clears stored state and the active override', () => {
    const td = new TestData();
    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    td.update(td.flag('flag').booleanFlag().variationForAll(true));
    td.removeFlag('flag');

    expect(debugOverride.removeOverride).toHaveBeenCalledWith('flag');
    expect(debugOverride.overrides['flag']).toBeUndefined();

    td.removeFlag('flag');
    expect(debugOverride.removeOverride).toHaveBeenCalledTimes(2);
  });

  it('removeFlag before registerDebug prevents the flag from being applied later', () => {
    const td = new TestData();
    td.update(td.flag('flag').booleanFlag().variationForAll(true));
    td.removeFlag('flag');

    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    expect(debugOverride.setOverride).not.toHaveBeenCalledWith('flag', expect.anything());
    expect(debugOverride.overrides['flag']).toBeUndefined();
  });

  it('clear() resets all stored flags and clears the override interface', () => {
    const td = new TestData();
    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    td.update(td.flag('a').booleanFlag().variationForAll(true));
    td.update(td.flag('b').valueForAll('x'));

    td.clear();

    expect(debugOverride.clearAllOverrides).toHaveBeenCalledTimes(1);
    expect(td.flag('a').resolve()).toBe(true); // back to fresh boolean default
  });

  it('clear() before registerDebug drops queued flags', () => {
    const td = new TestData();
    td.update(td.flag('a').booleanFlag().variationForAll(true));
    td.clear();

    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    expect(debugOverride.setOverride).not.toHaveBeenCalled();
  });

  it('throws if registerDebug is called twice', () => {
    const td = new TestData();
    td.registerDebug(createMockDebugOverride());

    expect(() => td.registerDebug(createMockDebugOverride())).toThrow(
      /already been registered/,
    );
  });

  it('handles flag keys that collide with Object prototype names safely', () => {
    const td = new TestData();
    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    // These keys would normally collide with Object.prototype members.
    td.update(td.flag('toString').valueForAll('overridden'));
    td.update(td.flag('hasOwnProperty').valueForAll(42));

    expect(debugOverride.setOverride).toHaveBeenCalledWith('toString', 'overridden');
    expect(debugOverride.setOverride).toHaveBeenCalledWith('hasOwnProperty', 42);

    // Re-reading these via td.flag must not return a stale Object.prototype member.
    expect(td.flag('toString').resolve()).toBe('overridden');
    expect(td.flag('hasOwnProperty').resolve()).toBe(42);

    // A flag key that was never set must still return the fresh boolean default,
    // even if the key name shadows an Object.prototype member.
    expect(new TestData().flag('toString').resolve()).toBe(true);
    expect(new TestData().flag('hasOwnProperty').resolve()).toBe(true);
  });
});
