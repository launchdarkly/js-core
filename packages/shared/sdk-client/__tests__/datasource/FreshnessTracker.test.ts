import { Context, Crypto, Hasher, Storage } from '@launchdarkly/js-sdk-common';

import { createFreshnessTracker } from '../../src/datasource/FreshnessTracker';

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

function makeMockCrypto(): Crypto {
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
    randomUUID: jest.fn(() => 'test-uuid'),
  };
}

const TEST_NAMESPACE = 'TestNamespace';

describe('FreshnessTracker', () => {
  let crypto: Crypto;
  let context: Context;

  beforeEach(() => {
    crypto = makeMockCrypto();
    context = Context.fromLDContext({ kind: 'user', key: 'test-user' });
  });

  it('returns undefined freshness when nothing has been recorded', async () => {
    const storage = makeMemoryStorage();
    const tracker = createFreshnessTracker(storage, crypto, TEST_NAMESPACE);

    const freshness = await tracker.getFreshness(context);
    expect(freshness).toBeUndefined();
  });

  it('records and retrieves freshness timestamp', async () => {
    const storage = makeMemoryStorage();
    const tracker = createFreshnessTracker(storage, crypto, TEST_NAMESPACE, () => 1000);

    await tracker.recordFreshness(context);
    const freshness = await tracker.getFreshness(context);

    expect(freshness).toBe(1000);
  });

  it('overwrites previous freshness on re-record', async () => {
    const storage = makeMemoryStorage();
    let time = 1000;
    const tracker = createFreshnessTracker(storage, crypto, TEST_NAMESPACE, () => time);

    await tracker.recordFreshness(context);
    time = 2000;
    await tracker.recordFreshness(context);

    const freshness = await tracker.getFreshness(context);
    expect(freshness).toBe(2000);
  });

  it('returns undefined when storage is not available', async () => {
    const tracker = createFreshnessTracker(undefined, crypto, TEST_NAMESPACE);

    const freshness = await tracker.getFreshness(context);
    expect(freshness).toBeUndefined();
  });

  it('does not throw when recording with no storage', async () => {
    const tracker = createFreshnessTracker(undefined, crypto, TEST_NAMESPACE);
    await expect(tracker.recordFreshness(context)).resolves.toBeUndefined();
  });

  it('returns 0 delay when no freshness exists (poll immediately)', async () => {
    const storage = makeMemoryStorage();
    const tracker = createFreshnessTracker(storage, crypto, TEST_NAMESPACE);

    const delay = await tracker.getNextPollDelayMs(context, 60000);
    expect(delay).toBe(0);
  });

  it('returns remaining interval when data was recently received', async () => {
    const storage = makeMemoryStorage();
    let time = 1000;
    const tracker = createFreshnessTracker(storage, crypto, TEST_NAMESPACE, () => time);

    await tracker.recordFreshness(context);

    // Advance time by 500ms; poll interval is 2000ms
    time = 1500;
    const delay = await tracker.getNextPollDelayMs(context, 2000);
    expect(delay).toBe(1500);
  });

  it('returns 0 delay when data is stale beyond poll interval', async () => {
    const storage = makeMemoryStorage();
    let time = 1000;
    const tracker = createFreshnessTracker(storage, crypto, TEST_NAMESPACE, () => time);

    await tracker.recordFreshness(context);

    // Advance time well past the poll interval
    time = 5000;
    const delay = await tracker.getNextPollDelayMs(context, 2000);
    expect(delay).toBe(0);
  });

  it('handles corrupt freshness data gracefully', async () => {
    // Storage that always returns a non-numeric string
    const corruptStorage: Storage = {
      get: async () => 'not-a-number',
      set: async () => {},
      clear: async () => {},
    };
    const tracker = createFreshnessTracker(corruptStorage, crypto, TEST_NAMESPACE);

    const freshness = await tracker.getFreshness(context);
    expect(freshness).toBeUndefined();
  });

  it('uses injected timeStamper for recording', async () => {
    const storage = makeMemoryStorage();
    const stamper = jest.fn(() => 42000);
    const tracker = createFreshnessTracker(storage, crypto, TEST_NAMESPACE, stamper);

    await tracker.recordFreshness(context);

    expect(stamper).toHaveBeenCalled();
    const freshness = await tracker.getFreshness(context);
    expect(freshness).toBe(42000);
  });

  it('uses injected timeStamper for delay calculation', async () => {
    const storage = makeMemoryStorage();
    let time = 10000;
    const stamper = jest.fn(() => time);
    const tracker = createFreshnessTracker(storage, crypto, TEST_NAMESPACE, stamper);

    await tracker.recordFreshness(context);
    time = 10300;

    const delay = await tracker.getNextPollDelayMs(context, 1000);
    expect(delay).toBe(700);
  });

  it('tracks freshness per context independently', async () => {
    const storage = makeMemoryStorage();
    let time = 1000;
    const tracker = createFreshnessTracker(storage, crypto, TEST_NAMESPACE, () => time);

    const context1 = Context.fromLDContext({ kind: 'user', key: 'user-1' });
    const context2 = Context.fromLDContext({ kind: 'user', key: 'user-2' });

    await tracker.recordFreshness(context1);
    time = 2000;
    await tracker.recordFreshness(context2);

    const freshness1 = await tracker.getFreshness(context1);
    const freshness2 = await tracker.getFreshness(context2);

    expect(freshness1).toBe(1000);
    expect(freshness2).toBe(2000);
  });

  it('returns 0 delay when storage is not available', async () => {
    const tracker = createFreshnessTracker(undefined, crypto, TEST_NAMESPACE);

    const delay = await tracker.getNextPollDelayMs(context, 60000);
    expect(delay).toBe(0);
  });
});
