import { Context, Crypto, Hasher, LDLogger, Platform, Storage } from '@launchdarkly/js-sdk-common';

import DefaultFlagManager from '../../src/flag-manager/FlagManager';
import { FlagsChangeCallback } from '../../src/flag-manager/FlagUpdater';
import { ItemDescriptor } from '../../src/flag-manager/ItemDescriptor';
import { Flag } from '../../src/types';

const TEST_SDK_KEY = 'test-sdk-key';
const TEST_MAX_CACHED_CONTEXTS = 5;

function makeMockPlatform(storage: Storage, crypto: Crypto): Platform {
  return {
    storage,
    crypto,
    info: {
      platformData: jest.fn(),
      sdkData: jest.fn(),
    },
    requests: {
      fetch: jest.fn(),
      createEventSource: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
  };
}

function makeMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get: async (key: string) => {
      const value = data.get(key);
      return value !== undefined ? value : null;
    },
    set: async (key: string, value: string) => {
      data.set(key, value);
    },
    clear: async (key: string) => {
      data.delete(key);
    },
  };
}

function makeMockCrypto() {
  let counter = 0;
  let lastInput = '';
  const hasher: Hasher = {
    update: jest.fn((input) => {
      lastInput = input;
      return hasher;
    }),
    digest: jest.fn(() => `${lastInput}Hashed`),
  };

  return {
    createHash: jest.fn(() => hasher),
    createHmac: jest.fn(),
    randomUUID: jest.fn(() => {
      counter += 1;
      return `${counter}`;
    }),
  };
}

function makeMockLogger(): LDLogger {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

function makeMockFlag(version: number = 1, value: any = 'test-value'): Flag {
  return {
    version,
    flagVersion: version,
    value,
    variation: 0,
    trackEvents: false,
  };
}

function makeMockItemDescriptor(version: number = 1, value: any = 'test-value'): ItemDescriptor {
  return {
    version,
    flag: makeMockFlag(version, value),
  };
}

describe('given a flag manager', () => {
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
      mockLogger,
    );
  });

  it('applies a full changeset replacing all flags', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });

    await flagManager.applyChanges(
      context,
      {
        'flag-a': makeMockItemDescriptor(1, 'a'),
        'flag-b': makeMockItemDescriptor(2, 'b'),
      },
      true,
    );

    expect(flagManager.get('flag-a')?.flag.value).toBe('a');
    expect(flagManager.get('flag-b')?.flag.value).toBe('b');
  });

  it('applies a full changeset that replaces previous flags', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });

    await flagManager.applyChanges(context, { old: makeMockItemDescriptor(1, 'old') }, true);
    await flagManager.applyChanges(context, { new: makeMockItemDescriptor(2, 'new') }, true);

    expect(flagManager.get('old')).toBeUndefined();
    expect(flagManager.get('new')?.flag.value).toBe('new');
  });

  it('applies a partial changeset upserting individual flags', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });

    await flagManager.applyChanges(
      context,
      {
        'flag-a': makeMockItemDescriptor(1, 'a'),
        'flag-b': makeMockItemDescriptor(1, 'b'),
      },
      true,
    );

    await flagManager.applyChanges(context, { 'flag-b': makeMockItemDescriptor(2, 'b2') }, false);

    expect(flagManager.get('flag-a')?.flag.value).toBe('a');
    expect(flagManager.get('flag-b')?.flag.value).toBe('b2');
  });

  it('applies a partial changeset that adds new flags', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });

    await flagManager.applyChanges(context, { existing: makeMockItemDescriptor(1, 'e') }, true);
    await flagManager.applyChanges(context, { added: makeMockItemDescriptor(1, 'new') }, false);

    expect(flagManager.get('existing')?.flag.value).toBe('e');
    expect(flagManager.get('added')?.flag.value).toBe('new');
  });

  it('applies empty changeset without error', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    await flagManager.applyChanges(context, {}, false);
    expect(Object.keys(flagManager.getAll())).toHaveLength(0);
  });

  it('returns undefined for selector and environmentId initially', () => {
    expect(flagManager.getSelector()).toBeUndefined();
    expect(flagManager.getEnvironmentId()).toBeUndefined();
  });

  it('stores selector from applyChanges', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    await flagManager.applyChanges(context, {}, true, 'sel-1');
    expect(flagManager.getSelector()).toBe('sel-1');
  });

  it('updates selector on subsequent applyChanges', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    await flagManager.applyChanges(context, {}, true, 'sel-1');
    await flagManager.applyChanges(context, {}, false, 'sel-2');
    expect(flagManager.getSelector()).toBe('sel-2');
  });

  it('does not clear selector when not provided', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    await flagManager.applyChanges(context, {}, true, 'sel-1');
    await flagManager.applyChanges(context, {}, false);
    expect(flagManager.getSelector()).toBe('sel-1');
  });

  it('stores environmentId from applyChanges', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    await flagManager.applyChanges(context, {}, true, undefined, 'env-123');
    expect(flagManager.getEnvironmentId()).toBe('env-123');
  });

  it('updates environmentId on subsequent applyChanges', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    await flagManager.applyChanges(context, {}, true, undefined, 'env-1');
    await flagManager.applyChanges(context, {}, false, undefined, 'env-2');
    expect(flagManager.getEnvironmentId()).toBe('env-2');
  });

  it('does not clear environmentId when not provided', async () => {
    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    await flagManager.applyChanges(context, {}, true, undefined, 'env-1');
    await flagManager.applyChanges(context, {}, false);
    expect(flagManager.getEnvironmentId()).toBe('env-1');
  });
});

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
