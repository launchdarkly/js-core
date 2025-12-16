import { jest } from '@jest/globals';

import { LDContext, LDFlagSet } from '@launchdarkly/js-client-sdk-common';

// Import after mocking
import { makeClient } from '../../src/BrowserClient';
import LDClientCompatImpl from '../../src/compat/LDClientCompatImpl';
import { LDOptions } from '../../src/compat/LDCompatOptions';
import { LDClient } from '../../src/LDClient';

// @ts-ignore
const mockBrowserClient: jest.MockedObject<LDClient> = {
  identify: jest.fn(),
  allFlags: jest.fn(),
  close: jest.fn(),
  flush: jest.fn(),
  setStreaming: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  variation: jest.fn(),
  variationDetail: jest.fn(),
  boolVariation: jest.fn(),
  boolVariationDetail: jest.fn(),
  numberVariation: jest.fn(),
  numberVariationDetail: jest.fn(),
  stringVariation: jest.fn(),
  stringVariationDetail: jest.fn(),
  jsonVariation: jest.fn(),
  jsonVariationDetail: jest.fn(),
  track: jest.fn(),
  addHook: jest.fn(),
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  getContext: jest.fn(),
  start: jest.fn(),
};

jest.mock('../../src/BrowserClient', () => ({
  __esModule: true,
  makeClient: jest.fn(),
}));

const mockMakeClient = makeClient as jest.MockedFunction<typeof makeClient>;

afterEach(() => {
  jest.clearAllMocks();
});

beforeEach(() => {
  // Restore the mock implementation after clearing
  mockMakeClient.mockReturnValue(mockBrowserClient);
});

describe('given a LDClientCompatImpl client with mocked browser client that is immediately ready', () => {
  let client: LDClientCompatImpl;

  beforeEach(() => {
    jest.useFakeTimers();
    mockBrowserClient.identify.mockImplementation(() => Promise.resolve({ status: 'completed' }));
    client = new LDClientCompatImpl('env-key', { kind: 'user', key: 'user-key' });
  });

  it('should resolve waitForInitialization when the client is already initialized', async () => {
    jest.advanceTimersToNextTimer();
    mockBrowserClient.identify.mockResolvedValue({ status: 'completed' });

    await expect(client.waitForInitialization()).resolves.toBeUndefined();
    expect(mockBrowserClient.identify).toHaveBeenCalledWith(
      { kind: 'user', key: 'user-key' },
      { bootstrap: undefined, hash: undefined, noTimeout: true, sheddable: false },
    );
  });
});

describe('given a LDClientCompatImpl client with mocked browser client that initializes after a delay', () => {
  let client: LDClientCompatImpl;

  beforeEach(() => {
    jest.useFakeTimers();
    mockBrowserClient.identify.mockImplementation(
      () =>
        new Promise((r) => {
          setTimeout(() => r({ status: 'completed' }), 100);
        }),
    );
    client = new LDClientCompatImpl('env-key', { kind: 'user', key: 'user-key' });
  });

  it('should return a promise from identify when no callback is provided', async () => {
    jest.advanceTimersToNextTimer();
    const context: LDContext = { kind: 'user', key: 'new-user' };
    const mockFlags: LDFlagSet = { flag1: true, flag2: false };

    mockBrowserClient.identify.mockResolvedValue({ status: 'completed' });
    mockBrowserClient.allFlags.mockReturnValue(mockFlags);

    const result = await client.identify(context);

    expect(mockBrowserClient.identify).toHaveBeenCalledWith(context, {
      hash: undefined,
      sheddable: false,
    });
    expect(result).toEqual(mockFlags);
  });

  it('should call the callback when provided to identify', (done) => {
    jest.advanceTimersToNextTimer();
    const context: LDContext = { kind: 'user', key: 'new-user' };
    const mockFlags: LDFlagSet = { flag1: true, flag2: false };

    mockBrowserClient.allFlags.mockReturnValue(mockFlags);
    mockBrowserClient.identify.mockImplementation(() => Promise.resolve({ status: 'completed' }));
    // Starting advancing the timers for the nest call. The wrapped promises
    // do not resolve sychronously.
    jest.advanceTimersToNextTimerAsync();

    client.identify(context, undefined, (err, flags) => {
      expect(err).toBeNull();
      expect(flags).toEqual(mockFlags);
      done();
    });
  });

  it('should return a promise from close when no callback is provided', async () => {
    jest.advanceTimersToNextTimer();
    mockBrowserClient.close.mockResolvedValue();

    await expect(client.close()).resolves.toBeUndefined();
    expect(mockBrowserClient.close).toHaveBeenCalled();
  });

  it('should call the callback when provided to close', (done) => {
    jest.advanceTimersToNextTimer();
    mockBrowserClient.close.mockResolvedValue();

    client.close(() => {
      expect(mockBrowserClient.close).toHaveBeenCalled();
      done();
    });
  });

  it('should return a promise from flush when no callback is provided', async () => {
    jest.advanceTimersToNextTimer();
    mockBrowserClient.flush.mockResolvedValue({ result: true });

    await expect(client.flush()).resolves.toBeUndefined();
    expect(mockBrowserClient.flush).toHaveBeenCalled();
  });

  it('should call the callback when provided to flush', (done) => {
    jest.advanceTimersToNextTimer();
    mockBrowserClient.flush.mockResolvedValue({ result: true });

    // Starting advancing the timers for the nest call. The wrapped promises
    // do not resolve sychronously.
    jest.advanceTimersToNextTimerAsync();
    jest.advanceTimersToNextTimerAsync();
    client.flush(() => {
      expect(mockBrowserClient.flush).toHaveBeenCalled();
      done();
    });
  });

  it('should resolve waitForInitialization when the client is initialized', async () => {
    jest.advanceTimersToNextTimer();
    mockBrowserClient.identify.mockResolvedValue({ status: 'completed' });

    await expect(client.waitForInitialization()).resolves.toBeUndefined();
    expect(mockBrowserClient.identify).toHaveBeenCalledWith(
      { kind: 'user', key: 'user-key' },
      { bootstrap: undefined, hash: undefined, noTimeout: true, sheddable: false },
    );
  });

  it('should resolve second waitForInitialization immediately', async () => {
    jest.advanceTimersToNextTimer();
    mockBrowserClient.identify.mockResolvedValue({ status: 'completed' });

    await expect(client.waitForInitialization()).resolves.toBeUndefined();
    await expect(client.waitForInitialization()).resolves.toBeUndefined();
    expect(mockBrowserClient.identify).toHaveBeenCalledWith(
      { kind: 'user', key: 'user-key' },
      { bootstrap: undefined, hash: undefined, noTimeout: true, sheddable: false },
    );
  });

  it('should resolve waitUntilReady immediately if the client is already initialized', async () => {
    jest.advanceTimersToNextTimer();
    mockBrowserClient.identify.mockResolvedValue({ status: 'completed' });

    await expect(client.waitUntilReady()).resolves.toBeUndefined();
    expect(mockBrowserClient.identify).toHaveBeenCalledWith(
      { kind: 'user', key: 'user-key' },
      { bootstrap: undefined, hash: undefined, noTimeout: true, sheddable: false },
    );
  });

  it('should log a warning when no timeout is specified for waitForInitialization', async () => {
    jest.advanceTimersToNextTimerAsync();
    await client.waitForInitialization();

    expect(mockBrowserClient.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'The waitForInitialization function was called without a timeout specified.',
      ),
    );
  });

  it('should apply a timeout when specified for waitForInitialization', async () => {
    jest.useRealTimers();
    await expect(async () => client.waitForInitialization(0.25)).rejects.toThrow();
  });

  it('should pass through allFlags call', () => {
    const mockFlags = { flag1: true, flag2: false };
    mockBrowserClient.allFlags.mockReturnValue(mockFlags);

    const result = client.allFlags();

    expect(result).toEqual(mockFlags);
    expect(mockBrowserClient.allFlags).toHaveBeenCalled();
  });

  it('should pass through variation call', () => {
    const flagKey = 'test-flag';
    const defaultValue = false;
    mockBrowserClient.variation.mockReturnValue(true);

    const result = client.variation(flagKey, defaultValue);

    expect(result).toBe(true);
    expect(mockBrowserClient.variation).toHaveBeenCalledWith(flagKey, defaultValue);
  });

  it('should pass through variationDetail call', () => {
    const flagKey = 'test-flag';
    const defaultValue = 'default';
    const mockDetail = { value: 'test', variationIndex: 1, reason: { kind: 'OFF' } };
    mockBrowserClient.variationDetail.mockReturnValue(mockDetail);

    const result = client.variationDetail(flagKey, defaultValue);

    expect(result).toEqual(mockDetail);
    expect(mockBrowserClient.variationDetail).toHaveBeenCalledWith(flagKey, defaultValue);
  });

  it('should pass through boolVariation call', () => {
    const flagKey = 'bool-flag';
    const defaultValue = false;
    mockBrowserClient.boolVariation.mockReturnValue(true);

    const result = client.boolVariation(flagKey, defaultValue);

    expect(result).toBe(true);
    expect(mockBrowserClient.boolVariation).toHaveBeenCalledWith(flagKey, defaultValue);
  });

  it('should pass through boolVariationDetail call', () => {
    const flagKey = 'bool-flag';
    const defaultValue = false;
    const mockDetail = { value: true, variationIndex: 1, reason: { kind: 'OFF' } };
    mockBrowserClient.boolVariationDetail.mockReturnValue(mockDetail);

    const result = client.boolVariationDetail(flagKey, defaultValue);

    expect(result).toEqual(mockDetail);
    expect(mockBrowserClient.boolVariationDetail).toHaveBeenCalledWith(flagKey, defaultValue);
  });

  it('should pass through stringVariation call', () => {
    const flagKey = 'string-flag';
    const defaultValue = 'default';
    mockBrowserClient.stringVariation.mockReturnValue('test');

    const result = client.stringVariation(flagKey, defaultValue);

    expect(result).toBe('test');
    expect(mockBrowserClient.stringVariation).toHaveBeenCalledWith(flagKey, defaultValue);
  });

  it('should pass through stringVariationDetail call', () => {
    const flagKey = 'string-flag';
    const defaultValue = 'default';
    const mockDetail = { value: 'test', variationIndex: 1, reason: { kind: 'OFF' } };
    mockBrowserClient.stringVariationDetail.mockReturnValue(mockDetail);

    const result = client.stringVariationDetail(flagKey, defaultValue);

    expect(result).toEqual(mockDetail);
    expect(mockBrowserClient.stringVariationDetail).toHaveBeenCalledWith(flagKey, defaultValue);
  });

  it('should pass through numberVariation call', () => {
    const flagKey = 'number-flag';
    const defaultValue = 0;
    mockBrowserClient.numberVariation.mockReturnValue(42);

    const result = client.numberVariation(flagKey, defaultValue);

    expect(result).toBe(42);
    expect(mockBrowserClient.numberVariation).toHaveBeenCalledWith(flagKey, defaultValue);
  });

  it('should pass through numberVariationDetail call', () => {
    const flagKey = 'number-flag';
    const defaultValue = 0;
    const mockDetail = { value: 42, variationIndex: 1, reason: { kind: 'OFF' } };
    mockBrowserClient.numberVariationDetail.mockReturnValue(mockDetail);

    const result = client.numberVariationDetail(flagKey, defaultValue);

    expect(result).toEqual(mockDetail);
    expect(mockBrowserClient.numberVariationDetail).toHaveBeenCalledWith(flagKey, defaultValue);
  });

  it('should pass through jsonVariation call', () => {
    const flagKey = 'json-flag';
    const defaultValue = { default: true };
    const mockJson = { test: 'value' };
    mockBrowserClient.jsonVariation.mockReturnValue(mockJson);

    const result = client.jsonVariation(flagKey, defaultValue);

    expect(result).toEqual(mockJson);
    expect(mockBrowserClient.jsonVariation).toHaveBeenCalledWith(flagKey, defaultValue);
  });

  it('should pass through jsonVariationDetail call', () => {
    const flagKey = 'json-flag';
    const defaultValue = { default: true };
    const mockDetail = { value: { test: 'value' }, variationIndex: 1, reason: { kind: 'OFF' } };
    mockBrowserClient.jsonVariationDetail.mockReturnValue(mockDetail);

    const result = client.jsonVariationDetail(flagKey, defaultValue);

    expect(result).toEqual(mockDetail);
    expect(mockBrowserClient.jsonVariationDetail).toHaveBeenCalledWith(flagKey, defaultValue);
  });

  it('should pass through track call', () => {
    const eventName = 'test-event';
    const data = { key: 'value' };
    const metricValue = 1.5;

    client.track(eventName, data, metricValue);

    expect(mockBrowserClient.track).toHaveBeenCalledWith(eventName, data, metricValue);
  });

  it('should pass through getContext call', () => {
    const mockContext = { kind: 'user', key: 'user-key' };
    mockBrowserClient.getContext.mockReturnValue(mockContext);

    const result = client.getContext();

    expect(result).toEqual(mockContext);
    expect(mockBrowserClient.getContext).toHaveBeenCalled();
  });

  it('should pass through setStreaming call', () => {
    const streamingEnabled = true;

    client.setStreaming(streamingEnabled);

    expect(mockBrowserClient.setStreaming).toHaveBeenCalledWith(streamingEnabled);
  });

  it('should emit ready and initialized events', async () => {
    const readyListener = jest.fn();
    const initializedListener = jest.fn();

    client.on('ready', readyListener);
    client.on('initialized', initializedListener);

    jest.advanceTimersToNextTimerAsync();
    await client.waitForInitialization();

    expect(readyListener).toHaveBeenCalledTimes(1);
    expect(initializedListener).toHaveBeenCalledTimes(1);
  });

  it('it unregisters ready andinitialized handlers handlers', async () => {
    const readyListener = jest.fn();
    const initializedListener = jest.fn();

    client.on('ready', readyListener);
    client.on('initialized', initializedListener);

    client.off('ready', readyListener);
    client.off('initialized', initializedListener);

    jest.advanceTimersToNextTimerAsync();
    await client.waitForInitialization();

    expect(readyListener).not.toHaveBeenCalled();
    expect(initializedListener).not.toHaveBeenCalled();
  });

  it('forwards addHook calls to BrowserClient', () => {
    const testHook = {
      getMetadata: () => ({ name: 'Test Hook' }),
    };

    client.addHook(testHook);

    expect(mockBrowserClient.addHook).toHaveBeenCalledWith(testHook);
  });
});

it('forwards bootstrap and hash to BrowserClient identify call', async () => {
  mockBrowserClient.identify.mockImplementation(
    () =>
      new Promise((r) => {
        setTimeout(r, 100);
      }),
  );
  const bootstrapData = { flagKey: { version: 1, variation: 0, value: true } };
  const options: LDOptions = {
    bootstrap: bootstrapData,
    hash: 'someHash',
  };
  const context: LDContext = { kind: 'user', key: 'user-key' };

  // We are testing side-effects, ignore we are not assigning the client.
  // eslint-disable-next-line no-new
  new LDClientCompatImpl('env-key', context, options);

  expect(mockBrowserClient.identify).toHaveBeenCalledWith(context, {
    bootstrap: bootstrapData,
    hash: 'someHash',
    noTimeout: true,
    sheddable: false,
  });
});

describe('given a LDClientCompatImpl client with mocked browser client which fails to initialize', () => {
  let client: LDClientCompatImpl;

  beforeEach(() => {
    jest.useFakeTimers();
    mockBrowserClient.identify.mockImplementation(
      () =>
        new Promise((r, reject) => {
          setTimeout(() => reject(new Error('Identify failed')), 100);
        }),
    );
    client = new LDClientCompatImpl('env-key', { kind: 'user', key: 'user-key' });
  });

  it('should handle rejection of initial identification before waitForInitialization is called', async () => {
    await jest.advanceTimersToNextTimer();

    await expect(client.waitForInitialization()).rejects.toThrow('Identify failed');

    expect(mockBrowserClient.identify).toHaveBeenCalledWith(
      { kind: 'user', key: 'user-key' },
      { bootstrap: undefined, hash: undefined, noTimeout: true, sheddable: false },
    );
  });

  it('should handle rejection of initial identification after waitForInitialization is called', async () => {
    const makeAssertion = () =>
      expect(client.waitForInitialization()).rejects.toThrow('Identify failed');
    const promise = makeAssertion();
    jest.advanceTimersToNextTimer();
    await promise;

    expect(mockBrowserClient.identify).toHaveBeenCalledWith(
      { kind: 'user', key: 'user-key' },
      { bootstrap: undefined, hash: undefined, noTimeout: true, sheddable: false },
    );
  });

  it('should handle rejection of initial identification before waitUntilReady is called', async () => {
    await jest.advanceTimersToNextTimer();

    await expect(client.waitUntilReady()).resolves.toBeUndefined();

    expect(mockBrowserClient.identify).toHaveBeenCalledWith(
      { kind: 'user', key: 'user-key' },
      { bootstrap: undefined, hash: undefined, noTimeout: true, sheddable: false },
    );
  });

  it('should handle rejection of initial identification after waitUntilReady is called', async () => {
    const makeAssertion = () => expect(client.waitUntilReady()).resolves.toBeUndefined();
    const promise = makeAssertion();
    jest.advanceTimersToNextTimer();
    await promise;

    expect(mockBrowserClient.identify).toHaveBeenCalledWith(
      { kind: 'user', key: 'user-key' },
      { bootstrap: undefined, hash: undefined, noTimeout: true, sheddable: false },
    );
  });

  it('should emit failed and ready events', async () => {
    const readyListener = jest.fn();
    const failedListener = jest.fn();

    client.on('ready', readyListener);
    client.on('failed', failedListener);

    jest.advanceTimersToNextTimerAsync();
    await expect(client.waitForInitialization()).rejects.toThrow('Identify failed');

    expect(readyListener).toHaveBeenCalledTimes(1);
    expect(failedListener).toHaveBeenCalledTimes(1);
  });

  it('it unregisters failed handlers', async () => {
    const readyListener = jest.fn();
    const failedListener = jest.fn();

    client.on('ready', readyListener);
    client.on('failed', failedListener);

    client.off('ready', readyListener);
    client.off('failed', failedListener);

    jest.advanceTimersToNextTimerAsync();
    await expect(client.waitForInitialization()).rejects.toThrow('Identify failed');

    expect(readyListener).not.toHaveBeenCalled();
    expect(failedListener).not.toHaveBeenCalled();
  });
});
