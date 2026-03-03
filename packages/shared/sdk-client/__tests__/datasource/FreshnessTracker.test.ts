import { Context, Crypto, Storage } from '@launchdarkly/js-sdk-common';

import { createFreshnessTracker } from '../../src/datasource/FreshnessTracker';
import { makeMemoryStorage, makeMockCrypto } from '../flag-manager/flagManagerTestHelpers';

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
    // Storage that always returns non-JSON data
    const corruptStorage: Storage = {
      get: async () => 'not valid json!!!',
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

  it('tracks freshness per context key independently', async () => {
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

  it('returns undefined when context attributes change for same key', async () => {
    const storage = makeMemoryStorage();
    const tracker = createFreshnessTracker(storage, crypto, TEST_NAMESPACE, () => 1000);

    // Record freshness for a context with specific attributes
    const contextV1 = Context.fromLDContext({
      kind: 'user',
      key: 'test-user',
      name: 'Alice',
      email: 'alice@example.com',
    });
    await tracker.recordFreshness(contextV1);

    // Same key, different attributes — should be treated as stale
    const contextV2 = Context.fromLDContext({
      kind: 'user',
      key: 'test-user',
      name: 'Alice Updated',
      email: 'alice-new@example.com',
    });
    const freshness = await tracker.getFreshness(contextV2);
    expect(freshness).toBeUndefined();
  });

  it('returns freshness when context attributes match exactly', async () => {
    const storage = makeMemoryStorage();
    const tracker = createFreshnessTracker(storage, crypto, TEST_NAMESPACE, () => 5000);

    const contextA = Context.fromLDContext({
      kind: 'user',
      key: 'test-user',
      name: 'Alice',
    });
    await tracker.recordFreshness(contextA);

    // Identical context — freshness should be valid
    const contextB = Context.fromLDContext({
      kind: 'user',
      key: 'test-user',
      name: 'Alice',
    });
    const freshness = await tracker.getFreshness(contextB);
    expect(freshness).toBe(5000);
  });

  it('returns 0 delay when attributes change (poll immediately)', async () => {
    const storage = makeMemoryStorage();
    let time = 1000;
    const tracker = createFreshnessTracker(storage, crypto, TEST_NAMESPACE, () => time);

    const contextV1 = Context.fromLDContext({
      kind: 'user',
      key: 'test-user',
      country: 'US',
    });
    await tracker.recordFreshness(contextV1);

    time = 1100;
    const contextV2 = Context.fromLDContext({
      kind: 'user',
      key: 'test-user',
      country: 'UK',
    });
    // Attributes changed → stale → poll immediately
    const delay = await tracker.getNextPollDelayMs(contextV2, 60000);
    expect(delay).toBe(0);
  });
});
