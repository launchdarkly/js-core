import { Context, LDLogger, Platform } from '@launchdarkly/js-sdk-common';

import DefaultFlagManager from '../../src/flag-manager/FlagManager';
import { FlagsChangeCallback } from '../../src/flag-manager/FlagUpdater';
import {
  makeMemoryStorage,
  makeMockCrypto,
  makeMockItemDescriptor,
  makeMockLogger,
  makeMockPlatform,
} from './flagManagerTestHelpers';

const TEST_SDK_KEY = 'test-sdk-key';
const TEST_MAX_CACHED_CONTEXTS = 5;

describe('FlagManager override tests', () => {
  let flagManager: DefaultFlagManager;
  let mockPlatform: Platform;
  let mockLogger: LDLogger;

  beforeEach(() => {
    mockLogger = makeMockLogger();
    mockPlatform = makeMockPlatform(makeMemoryStorage(), makeMockCrypto());
    flagManager = new DefaultFlagManager(
      mockPlatform,
      TEST_SDK_KEY,
      TEST_MAX_CACHED_CONTEXTS,
      false,
      mockLogger,
    );
  });

  it('setOverride takes precedence over flag store value', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const flags = {
      'test-flag': makeMockItemDescriptor(1, 'store-value'),
    };

    await flagManager.init(context, flags);
    expect(flagManager.get('test-flag')?.flag.value).toBe('store-value');

    const debugOverride = flagManager.getDebugOverride();
    debugOverride?.setOverride('test-flag', 'override-value');

    expect(flagManager.get('test-flag')?.flag.value).toBe('override-value');
  });

  it('setOverride triggers flag change callback', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const flags = {
      'test-flag': makeMockItemDescriptor(1, 'store-value'),
    };

    await flagManager.init(context, flags);

    const mockCallback: FlagsChangeCallback = jest.fn();
    flagManager.on(mockCallback);

    const debugOverride = flagManager.getDebugOverride();
    debugOverride?.setOverride('test-flag', 'override-value');

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith(context, ['test-flag'], 'override');
  });

  it('removeOverride does nothing when override does not exist', () => {
    const debugOverride = flagManager.getDebugOverride();
    expect(() => {
      debugOverride?.removeOverride('non-existent-flag');
    }).not.toThrow();
  });

  it('removeOverride reverts to flag store value when override is removed', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const flags = {
      'test-flag': makeMockItemDescriptor(1, 'store-value'),
    };

    await flagManager.init(context, flags);
    const debugOverride = flagManager.getDebugOverride();
    debugOverride?.setOverride('test-flag', 'override-value');
    expect(flagManager.get('test-flag')?.flag.value).toBe('override-value');

    debugOverride?.removeOverride('test-flag');
    expect(flagManager.get('test-flag')?.flag.value).toBe('store-value');
  });

  it('removeOverride triggers flag change callback', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const flags = {
      'test-flag': makeMockItemDescriptor(1, 'store-value'),
    };

    await flagManager.init(context, flags);

    const mockCallback: FlagsChangeCallback = jest.fn();
    flagManager.on(mockCallback);

    const debugOverride = flagManager.getDebugOverride();
    debugOverride?.setOverride('test-flag', 'override-value');
    debugOverride?.removeOverride('test-flag');

    expect(mockCallback).toHaveBeenCalledTimes(2);
    expect(mockCallback).toHaveBeenNthCalledWith(1, context, ['test-flag'], 'override');
    expect(mockCallback).toHaveBeenNthCalledWith(2, context, ['test-flag'], 'override');
  });

  it('clearAllOverrides removes all overrides', () => {
    const debugOverride = flagManager.getDebugOverride();
    debugOverride?.setOverride('flag1', 'value1');
    debugOverride?.setOverride('flag2', 'value2');
    debugOverride?.setOverride('flag3', 'value3');

    expect(Object.keys(flagManager.getAllOverrides())).toHaveLength(3);

    debugOverride?.clearAllOverrides();
    expect(Object.keys(flagManager.getAllOverrides())).toHaveLength(0);
  });

  it('clearAllOverrides triggers flag change callback for all flags', async () => {
    const mockCallback: FlagsChangeCallback = jest.fn();
    flagManager.on(mockCallback);

    const debugOverride = flagManager.getDebugOverride();
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const flags = {
      'test-flag': makeMockItemDescriptor(1, 'store-value'),
    };

    await flagManager.init(context, flags);

    debugOverride?.setOverride('flag1', 'value1');
    debugOverride?.setOverride('flag2', 'value2');
    (mockCallback as jest.Mock).mockClear();

    debugOverride?.clearAllOverrides();
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith(context, ['flag1', 'flag2'], 'override');
  });

  it('getAllOverrides returns all overrides as ItemDescriptors', () => {
    const debugOverride = flagManager.getDebugOverride();
    debugOverride?.setOverride('flag1', 'value1');
    debugOverride?.setOverride('flag2', 42);
    debugOverride?.setOverride('flag3', true);

    const overrides = debugOverride?.getAllOverrides();
    expect(overrides).toHaveProperty('flag1');
    expect(overrides).toHaveProperty('flag2');
    expect(overrides).toHaveProperty('flag3');
    expect(overrides?.flag1.flag.value).toBe('value1');
    expect(overrides?.flag2.flag.value).toBe(42);
    expect(overrides?.flag3.flag.value).toBe(true);
    expect(overrides?.flag1.version).toBe(0);
    expect(overrides?.flag2.version).toBe(0);
    expect(overrides?.flag3.version).toBe(0);
  });

  it('getAll merges overrides with flag store values', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const flags = {
      'store-flag': makeMockItemDescriptor(1, 'store-value'),
      'shared-flag': makeMockItemDescriptor(1, 'store-value'),
    };

    await flagManager.init(context, flags);
    const debugOverride = flagManager.getDebugOverride();
    debugOverride?.setOverride('shared-flag', 'override-value');
    debugOverride?.setOverride('override-only-flag', 'override-value');

    const allFlags = flagManager.getAll();
    expect(allFlags).toHaveProperty('store-flag');
    expect(allFlags).toHaveProperty('shared-flag');
    expect(allFlags).toHaveProperty('override-only-flag');
    expect(allFlags['store-flag'].flag.value).toBe('store-value');
    expect(allFlags['shared-flag'].flag.value).toBe('override-value');
    expect(allFlags['override-only-flag'].flag.value).toBe('override-value');
  });
});
