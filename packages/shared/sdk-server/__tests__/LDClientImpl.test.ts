import {
  basicPlatform,
  MockStreamingProcessor,
  setupMockStreamingProcessor,
} from '@launchdarkly/private-js-mocks';

import { LDClientImpl, LDOptions } from '../src';
import TestLogger, { LogLevel } from './Logger';

jest.mock('@launchdarkly/js-sdk-common', () => {
  const actual = jest.requireActual('@launchdarkly/js-sdk-common');
  return {
    ...actual,
    ...{
      internal: {
        ...actual.internal,
        StreamingProcessor: MockStreamingProcessor,
      },
    },
  };
});

describe('LDClientImpl', () => {
  let client: LDClientImpl;
  const callbacks = {
    onFailed: jest.fn().mockName('onFailed'),
    onError: jest.fn().mockName('onError'),
    onReady: jest.fn().mockName('onReady'),
    onUpdate: jest.fn().mockName('onUpdate'),
    hasEventListeners: jest.fn().mockName('hasEventListeners'),
  };
  const createClient = (options: LDOptions = {}) =>
    new LDClientImpl('sdk-key', basicPlatform, options, callbacks);

  beforeEach(() => {
    setupMockStreamingProcessor();
  });

  afterEach(() => {
    client.close();
    jest.resetAllMocks();
  });

  it('fires ready event in online mode', async () => {
    client = createClient();
    const initializedClient = await client.waitForInitialization({ timeout: 10 });

    expect(initializedClient).toEqual(client);
    expect(client.initialized()).toBeTruthy();
    expect(callbacks.onReady).toBeCalled();
    expect(callbacks.onFailed).not.toBeCalled();
    expect(callbacks.onError).not.toBeCalled();
  });

  it('wait for initialization completes even if initialization completes before it is called', (done) => {
    setupMockStreamingProcessor();
    client = createClient();

    setTimeout(async () => {
      const initializedClient = await client.waitForInitialization({ timeout: 10 });
      expect(initializedClient).toEqual(client);
      done();
    }, 10);
  });

  it('waiting for initialization the second time produces the same result', async () => {
    client = createClient();
    await client.waitForInitialization({ timeout: 10 });

    const initializedClient = await client.waitForInitialization({ timeout: 10 });
    expect(initializedClient).toEqual(client);
  });

  it('fires ready event in offline mode', async () => {
    client = createClient({ offline: true });
    const initializedClient = await client.waitForInitialization({ timeout: 10 });

    expect(initializedClient).toEqual(client);
    expect(client.initialized()).toBeTruthy();
    expect(callbacks.onReady).toBeCalled();
    expect(callbacks.onFailed).not.toBeCalled();
    expect(callbacks.onError).not.toBeCalled();
  });

  it('initialization fails: failed event fires and initialization promise rejects', async () => {
    setupMockStreamingProcessor(true);
    client = createClient();

    await expect(client.waitForInitialization({ timeout: 10 })).rejects.toThrow('failed');

    expect(client.initialized()).toBeFalsy();
    expect(callbacks.onReady).not.toBeCalled();
    expect(callbacks.onFailed).toBeCalled();
    expect(callbacks.onError).toBeCalled();
  });

  it('initialization promise is rejected even if the failure happens before wait is called', (done) => {
    setupMockStreamingProcessor(true);
    client = createClient();

    setTimeout(async () => {
      await expect(client.waitForInitialization({ timeout: 10 })).rejects.toThrow('failed');

      expect(client.initialized()).toBeFalsy();
      expect(callbacks.onReady).not.toBeCalled();
      expect(callbacks.onFailed).toBeCalled();
      expect(callbacks.onError).toBeCalled();
      done();
    }, 10);
  });

  it('waiting a second time results in the same rejection', async () => {
    setupMockStreamingProcessor(true);
    client = createClient();

    await expect(client.waitForInitialization({ timeout: 10 })).rejects.toThrow('failed');
    await expect(client.waitForInitialization({ timeout: 10 })).rejects.toThrow('failed');
  });

  it('isOffline returns true in offline mode', () => {
    client = createClient({ offline: true });
    expect(client.isOffline()).toEqual(true);
  });

  it('does not crash when closing an offline client', () => {
    client = createClient({ offline: true });
    expect(() => client.close()).not.toThrow();
  });

  it('resolves immediately if the client is already ready', async () => {
    client = createClient();
    await client.waitForInitialization({ timeout: 10 });
    await client.waitForInitialization({ timeout: 10 });
  });

  it('creates only one Promise when waiting for initialization - when not using a timeout', async () => {
    client = createClient();
    const p1 = client.waitForInitialization();
    const p2 = client.waitForInitialization();

    expect(p2).toBe(p1);
  });

  it('rejects the returned promise when initialization does not complete within the timeout', async () => {
    setupMockStreamingProcessor(undefined, undefined, undefined, undefined, undefined, 10000);
    client = createClient();
    await expect(async () => client.waitForInitialization({ timeout: 1 })).rejects.toThrow(
      'waitForInitialization timed out after 1 seconds.',
    );
  });

  it('logs an error when the initialization does not complete within the timeout', async () => {
    setupMockStreamingProcessor(undefined, undefined, undefined, undefined, undefined, 10000);
    const logger = new TestLogger();
    client = createClient({ logger });
    try {
      await client.waitForInitialization({ timeout: 1 });
    } catch {
      // Not being tested in this test.
    }
    logger.expectMessages([
      {
        level: LogLevel.Error,
        matches: /waitForInitialization timed out after 1 seconds./,
      },
    ]);
  });

  it('does not reject the returned promise when initialization completes within the timeout', async () => {
    setupMockStreamingProcessor(undefined, undefined, undefined, undefined, undefined, 1000);
    client = createClient();
    await expect(async () => client.waitForInitialization({ timeout: 5 })).not.toThrow();
  });

  it('logs when no timeout is set', async () => {
    const logger = new TestLogger();
    client = createClient({ logger });
    await client.waitForInitialization();
    logger.expectMessages([
      {
        level: LogLevel.Warn,
        matches:
          /The waitForInitialization function was called without a timeout specified. In a future version a default timeout will be applied./,
      },
    ]);
  });

  it('logs when the timeout is too high', async () => {
    const logger = new TestLogger();
    client = createClient({ logger });
    await client.waitForInitialization({ timeout: Number.MAX_SAFE_INTEGER });

    logger.expectMessages([
      {
        level: LogLevel.Warn,
        matches:
          /The waitForInitialization function was called with a timeout greater than 60 seconds. We recommend a timeout of less than 60 seconds./,
      },
    ]);
  });

  it.each([1, 30, 59])(
    'does not log when timeout is under high timeout threshold',
    async (timeout) => {
      const logger = new TestLogger();
      client = createClient({ logger });
      await client.waitForInitialization({ timeout });
      expect(logger.getCount(LogLevel.Warn)).toBe(0);
    },
  );

  it('does not log when offline and no timeout it set', async () => {
    const logger = new TestLogger();
    client = createClient({ logger, offline: true });
    await client.waitForInitialization({ timeout: 10 });
    expect(logger.getCount(LogLevel.Warn)).toBe(0);
  });

  it('does not log when the timeout is too high and client is offline', async () => {
    const logger = new TestLogger();
    client = createClient({ logger, offline: true });
    await client.waitForInitialization({ timeout: Number.MAX_SAFE_INTEGER });
    expect(logger.getCount(LogLevel.Warn)).toBe(0);
  });

  it('does not log when useLdd is true and no timeout it set', async () => {
    const logger = new TestLogger();
    client = createClient({ logger, offline: true });
    await client.waitForInitialization({ timeout: 10 });
    expect(logger.getCount(LogLevel.Warn)).toBe(0);
  });

  it('does not log when useLdd is true and the timeout is too long', async () => {
    const logger = new TestLogger();
    client = createClient({ logger, offline: true });
    await client.waitForInitialization({ timeout: Number.MAX_SAFE_INTEGER });
    expect(logger.getCount(LogLevel.Warn)).toBe(0);
  });
});
