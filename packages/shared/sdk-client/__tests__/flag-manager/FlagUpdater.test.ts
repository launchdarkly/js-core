import { Context, LDLogger } from '@launchdarkly/js-sdk-common';

import { createDefaultFlagStore } from '../../src/flag-manager/FlagStore';
import createFlagUpdater, { FlagsChangeCallback } from '../../src/flag-manager/FlagUpdater';
import { Flag } from '../../src/types';

function makeMockFlag(): Flag {
  // the values of the flag object itself are not relevant for these tests, the
  // version on the item descriptor is what matters
  return {
    version: 0,
    flagVersion: 0,
    value: undefined,
    variation: 0,
    trackEvents: false,
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

describe('FlagUpdater tests', () => {
  test('init calls init on underlying flag store', async () => {
    const mockStore = createDefaultFlagStore();
    const mockStoreSpy = jest.spyOn(mockStore, 'init');
    const mockLogger = makeMockLogger();

    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const flags = {
      flagA: {
        version: 1,
        flag: makeMockFlag(),
      },
    };
    const updaterUnderTest = createFlagUpdater(mockStore, mockLogger);
    updaterUnderTest.init(context, flags);
    expect(mockStoreSpy).toHaveBeenCalledTimes(1);
    expect(mockStoreSpy).toHaveBeenLastCalledWith(flags);
  });

  test('triggers callbacks on init', async () => {
    const mockStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const mockCallback: FlagsChangeCallback = jest.fn();

    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const flags = {
      flagA: {
        version: 1,
        flag: makeMockFlag(),
      },
    };
    const updaterUnderTest = createFlagUpdater(mockStore, mockLogger);
    updaterUnderTest.on(mockCallback);
    updaterUnderTest.init(context, flags);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  test('init cached ignores context same as active context', async () => {
    const mockStore = createDefaultFlagStore();
    const mockStoreSpy = jest.spyOn(mockStore, 'init');
    const mockLogger = makeMockLogger();

    const activeContext = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const sameContext = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const flags = {
      flagA: {
        version: 1,
        flag: makeMockFlag(),
      },
    };
    const updaterUnderTest = createFlagUpdater(mockStore, mockLogger);
    updaterUnderTest.init(activeContext, flags);
    expect(mockStoreSpy).toHaveBeenCalledTimes(1);
    updaterUnderTest.initCached(sameContext, flags);
    expect(mockStoreSpy).toHaveBeenCalledTimes(1);
  });

  test('upsert ignores inactive context', async () => {
    const mockStore = createDefaultFlagStore();
    const mockStoreSpy = jest.spyOn(mockStore, 'init');
    const mockLogger = makeMockLogger();

    const activeContext = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const inactiveContext = Context.fromLDContext({ kind: 'anotherKind', key: 'another-key' });
    const flags = {
      flagA: {
        version: 1,
        flag: makeMockFlag(),
      },
    };
    const updaterUnderTest = createFlagUpdater(mockStore, mockLogger);
    updaterUnderTest.init(activeContext, flags);
    expect(mockStoreSpy).toHaveBeenCalledTimes(1);

    const didUpsert = updaterUnderTest.upsert(inactiveContext, 'flagA', {
      version: 1,
      flag: makeMockFlag(),
    });
    expect(didUpsert).toEqual(false);
  });

  test('upsert rejects data with old versions', async () => {
    const mockStore = createDefaultFlagStore();
    const mockStoreSpy = jest.spyOn(mockStore, 'init');
    const mockLogger = makeMockLogger();

    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const flags = {
      flagA: {
        version: 1,
        flag: makeMockFlag(),
      },
    };
    const updaterUnderTest = createFlagUpdater(mockStore, mockLogger);
    updaterUnderTest.init(context, flags);
    expect(mockStoreSpy).toHaveBeenCalledTimes(1);

    const didUpsert = updaterUnderTest.upsert(context, 'flagA', {
      version: 0,
      flag: makeMockFlag(),
    }); // version 0 should be ignored
    expect(didUpsert).toEqual(false);
  });

  test('upsert updates underlying store', async () => {
    const mockStore = createDefaultFlagStore();
    const mockStoreSpyInit = jest.spyOn(mockStore, 'init');
    const mockStoreSpyInsertOrUpdate = jest.spyOn(mockStore, 'insertOrUpdate');
    const mockLogger = makeMockLogger();

    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const flags = {
      flagA: {
        version: 1,
        flag: makeMockFlag(),
      },
    };
    const updaterUnderTest = createFlagUpdater(mockStore, mockLogger);
    updaterUnderTest.init(context, flags);
    expect(mockStoreSpyInit).toHaveBeenCalledTimes(1);

    const didUpsert = updaterUnderTest.upsert(context, 'flagA', {
      version: 2,
      flag: makeMockFlag(),
    }); // version is higher and should be inserted
    expect(didUpsert).toEqual(true);
    expect(mockStoreSpyInsertOrUpdate).toHaveBeenCalledTimes(1);
  });

  test('upsert triggers callbacks', async () => {
    const mockStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const mockCallbackA: FlagsChangeCallback = jest.fn();
    const mockCallbackB: FlagsChangeCallback = jest.fn();

    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const flags = {
      flagA: {
        version: 1,
        flag: makeMockFlag(),
      },
    };
    const updaterUnderTest = createFlagUpdater(mockStore, mockLogger);
    updaterUnderTest.init(context, flags);

    // register the callbacks
    updaterUnderTest.on(mockCallbackA);
    updaterUnderTest.on(mockCallbackB);

    const didUpsert = updaterUnderTest.upsert(context, 'flagA', {
      version: 2,
      flag: makeMockFlag(),
    }); // version is higher and should be inserted
    expect(didUpsert).toEqual(true);
    expect(mockCallbackA).toHaveBeenCalledTimes(1);
    expect(mockCallbackB).toHaveBeenCalledTimes(1);
  });

  test('off removes callback', async () => {
    const mockStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const mockCallback: FlagsChangeCallback = jest.fn();

    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const flags = {
      flagA: {
        version: 1,
        flag: makeMockFlag(),
      },
    };
    const updaterUnderTest = createFlagUpdater(mockStore, mockLogger);
    updaterUnderTest.init(context, flags);

    // register the callback
    updaterUnderTest.on(mockCallback);

    updaterUnderTest.upsert(context, 'flagA', {
      version: 2,
      flag: makeMockFlag(),
    }); // version is higher and should be inserted
    expect(mockCallback).toHaveBeenCalledTimes(1);

    // remove the callback
    updaterUnderTest.off(mockCallback);
    updaterUnderTest.upsert(context, 'flagA', {
      version: 3,
      flag: makeMockFlag(),
    }); // version is higher and should be inserted
    expect(mockCallback).toHaveBeenCalledTimes(1); // only 1 call still, not 2
  });

  test('off can be called many times safely', async () => {
    const mockStore = createDefaultFlagStore();
    const mockLogger = makeMockLogger();
    const mockCallback: FlagsChangeCallback = jest.fn();

    const context = Context.fromLDContext({ kind: 'user', key: 'user-key' });
    const flags = {
      flagA: {
        version: 1,
        flag: makeMockFlag(),
      },
    };
    const updaterUnderTest = createFlagUpdater(mockStore, mockLogger);
    updaterUnderTest.init(context, flags);
    updaterUnderTest.off(mockCallback);
    updaterUnderTest.on(mockCallback);
    updaterUnderTest.off(mockCallback);
    updaterUnderTest.off(mockCallback);
    updaterUnderTest.off(mockCallback);
  });
});
