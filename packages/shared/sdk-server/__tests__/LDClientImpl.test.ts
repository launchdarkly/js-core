import {
  basicPlatform,
  MockStreamingProcessor,
  setupMockStreamingProcessor,
} from '@launchdarkly/private-js-mocks';

import { LDClientImpl, LDOptions } from '../src';

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
    const initializedClient = await client.waitForInitialization();

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
      const initializedClient = await client.waitForInitialization();
      expect(initializedClient).toEqual(client);
      done();
    }, 10);
  });

  it('waiting for initialization the second time produces the same result', async () => {
    client = createClient();
    await client.waitForInitialization();

    const initializedClient = await client.waitForInitialization();
    expect(initializedClient).toEqual(client);
  });

  it('fires ready event in offline mode', async () => {
    client = createClient({ offline: true });
    const initializedClient = await client.waitForInitialization();

    expect(initializedClient).toEqual(client);
    expect(client.initialized()).toBeTruthy();
    expect(callbacks.onReady).toBeCalled();
    expect(callbacks.onFailed).not.toBeCalled();
    expect(callbacks.onError).not.toBeCalled();
  });

  it('initialization fails: failed event fires and initialization promise rejects', async () => {
    setupMockStreamingProcessor(true);
    client = createClient();

    await expect(client.waitForInitialization()).rejects.toThrow('failed');

    expect(client.initialized()).toBeFalsy();
    expect(callbacks.onReady).not.toBeCalled();
    expect(callbacks.onFailed).toBeCalled();
    expect(callbacks.onError).toBeCalled();
  });

  it.only('initialization promise is rejected even if the failure happens before wait is called', (done) => {
    setupMockStreamingProcessor(true);
    client = createClient();

    setTimeout(async () => {
      await expect(client.waitForInitialization()).rejects.toThrow('failed');

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

    await expect(client.waitForInitialization()).rejects.toThrow('failed');
    await expect(client.waitForInitialization()).rejects.toThrow('failed');
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
    await client.waitForInitialization();
    await client.waitForInitialization();
  });

  it('creates only one Promise when waiting for initialization', async () => {
    client = createClient();
    const p1 = client.waitForInitialization();
    const p2 = client.waitForInitialization();

    expect(p2).toBe(p1);
  });
});
