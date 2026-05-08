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
  it('returns correct plugin metadata', () => {
    expect(new TestData().getMetadata()).toEqual({ name: 'test-data' });
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

  it('seeds initial flags from the constructor and applies them on registerDebug', () => {
    const td = new TestData({
      'show-banner': true,
      greeting: 'Hello',
      'max-retries': 3,
      config: { theme: 'dark' },
    });

    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    expect(debugOverride.overrides['show-banner']).toBe(true);
    expect(debugOverride.overrides.greeting).toBe('Hello');
    expect(debugOverride.overrides['max-retries']).toBe(3);
    expect(debugOverride.overrides.config).toEqual({ theme: 'dark' });
  });

  it('typed setters chain and apply pre-registration', () => {
    const td = new TestData()
      .setBool('show-banner', true)
      .setString('greeting', 'Hello')
      .setNumber('max-retries', 3)
      .setJson('config', { theme: 'dark' });

    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    expect(debugOverride.overrides['show-banner']).toBe(true);
    expect(debugOverride.overrides.greeting).toBe('Hello');
    expect(debugOverride.overrides['max-retries']).toBe(3);
    expect(debugOverride.overrides.config).toEqual({ theme: 'dark' });
  });

  it('typed setters propagate live updates after registration', () => {
    const td = new TestData();
    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    td.setBool('show-banner', true);
    expect(debugOverride.setOverride).toHaveBeenCalledWith('show-banner', true);

    td.setString('greeting', 'Howdy');
    expect(debugOverride.setOverride).toHaveBeenCalledWith('greeting', 'Howdy');

    td.setNumber('max-retries', 5);
    expect(debugOverride.setOverride).toHaveBeenCalledWith('max-retries', 5);

    td.setJson('config', [1, 2, 3]);
    expect(debugOverride.setOverride).toHaveBeenCalledWith('config', [1, 2, 3]);
  });

  it('skips setOverride when the same primitive value is set twice', () => {
    const td = new TestData();
    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    td.setBool('flag', true);
    expect(debugOverride.setOverride).toHaveBeenCalledTimes(1);

    td.setBool('flag', true);
    expect(debugOverride.setOverride).toHaveBeenCalledTimes(1);

    td.setBool('flag', false);
    expect(debugOverride.setOverride).toHaveBeenCalledTimes(2);
  });

  it('dedups by reference equality, so passing a new object always fires', () => {
    const td = new TestData();
    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    td.setJson('cfg', { showBanner: true });
    expect(debugOverride.setOverride).toHaveBeenCalledTimes(1);

    // New object reference -- fires even though structurally identical.
    td.setJson('cfg', { showBanner: true });
    expect(debugOverride.setOverride).toHaveBeenCalledTimes(2);

    // Same reference twice in a row -- deduped.
    const same = { showBanner: false };
    td.setJson('cfg', same);
    td.setJson('cfg', same);
    expect(debugOverride.setOverride).toHaveBeenCalledTimes(3);
  });

  it('remove clears stored state and the active override', () => {
    const td = new TestData({ flag: true });
    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    td.remove('flag');

    expect(debugOverride.removeOverride).toHaveBeenCalledWith('flag');
    expect(debugOverride.overrides.flag).toBeUndefined();
  });

  it('remove before registerDebug prevents the flag from being applied later', () => {
    const td = new TestData({ flag: true });
    td.remove('flag');

    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    expect(debugOverride.setOverride).not.toHaveBeenCalled();
    expect(debugOverride.overrides.flag).toBeUndefined();
  });

  it('clear resets all flags and clears the override interface', () => {
    const td = new TestData({ a: true, b: 'x' });
    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    td.clear();

    expect(debugOverride.clearAllOverrides).toHaveBeenCalledTimes(1);
  });

  it('clear before registerDebug drops queued flags', () => {
    const td = new TestData({ a: true });
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

  it('setJson rejects undefined and other non-object values', () => {
    const td = new TestData();
    expect(() => td.setJson('flag', undefined as unknown as object)).toThrow(TypeError);
    expect(() => td.setJson('flag', null as unknown as object)).toThrow(TypeError);
    expect(() => td.setJson('flag', 'string' as unknown as object)).toThrow(TypeError);
    expect(() => td.setJson('flag', 42 as unknown as object)).toThrow(TypeError);
  });

  it('dedups NaN values via Object.is semantics', () => {
    const td = new TestData();
    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    td.setNumber('flag', NaN);
    expect(debugOverride.setOverride).toHaveBeenCalledTimes(1);

    td.setNumber('flag', NaN);
    expect(debugOverride.setOverride).toHaveBeenCalledTimes(1);

    td.setNumber('flag', 0);
    expect(debugOverride.setOverride).toHaveBeenCalledTimes(2);
  });

  it('remove and clear return this for chaining', () => {
    const td = new TestData({ a: true, b: 'x' });
    expect(td.remove('a')).toBe(td);
    expect(td.clear()).toBe(td);
  });

  it('handles flag keys that collide with Object prototype names safely', () => {
    const td = new TestData();
    const debugOverride = createMockDebugOverride();
    td.registerDebug(debugOverride);

    td.setString('toString', 'overridden').setNumber('hasOwnProperty', 42);

    expect(debugOverride.setOverride).toHaveBeenCalledWith('toString', 'overridden');
    expect(debugOverride.setOverride).toHaveBeenCalledWith('hasOwnProperty', 42);
  });
});
