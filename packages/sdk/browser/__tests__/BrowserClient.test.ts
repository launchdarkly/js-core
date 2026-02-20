import {
  AutoEnvAttributes,
  LDLogger,
  LDSingleKindContext,
} from '@launchdarkly/js-client-sdk-common';

import { makeClient } from '../src/BrowserClient';
import { makeBasicPlatform } from './BrowserClient.mocks';
import { goodBootstrapDataWithReasons } from './testBootstrapData';

function makeStreamingPlatform() {
  const eventSourceClose = jest.fn();
  const platform = makeBasicPlatform();
  // @ts-ignore
  platform.requests.createEventSource = jest.fn(() => ({
    close: eventSourceClose,
    addEventListener: jest.fn(),
    onclose: jest.fn(),
    onerror: jest.fn(),
    onopen: jest.fn(),
    onretrying: jest.fn(),
  }));
  return { platform, eventSourceClose };
}

describe('given a mock platform for a BrowserClient', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  let platform: any;
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { href: 'http://browserclientintegration.com' },
      writable: true,
    });
    jest.useFakeTimers().setSystemTime(new Date('2024-09-19'));
    platform = makeBasicPlatform();
  });

  it('includes urls in custom events', async () => {
    const client = makeClient(
      'client-side-id',
      { key: 'user-key', kind: 'user' },
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
      },
      platform,
    );
    await client.start();
    await client.flush();
    client.track('user-key', undefined, 1);
    await client.flush();

    expect(JSON.parse(platform.requests.fetch.mock.calls[3][1].body)[0]).toMatchObject({
      kind: 'custom',
      creationDate: 1726704000000,
      key: 'user-key',
      context: {
        key: 'user-key',
        kind: 'user',
      },
      metricValue: 1,
      url: 'http://browserclientintegration.com',
    });
  });

  it('can filter URLs in custom events', async () => {
    const client = makeClient(
      'client-side-id',
      { key: 'user-key', kind: 'user' },
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
        eventUrlTransformer: (url: string) =>
          url.replace('http://browserclientintegration.com', 'http://filtered.org'),
      },
      platform,
    );
    await client.start();
    await client.flush();
    client.track('user-key', undefined, 1);
    await client.flush();

    const events = JSON.parse(platform.requests.fetch.mock.calls[3][1].body);
    const customEvent = events.find((e: any) => e.kind === 'custom');

    expect(customEvent).toMatchObject({
      kind: 'custom',
      creationDate: 1726704000000,
      key: 'user-key',
      context: {
        key: 'user-key',
        kind: 'user',
      },
      metricValue: 1,
      url: 'http://filtered.org',
    });
  });

  it('can filter URLs in click events', async () => {
    const client = makeClient(
      'client-side-id',
      { key: 'user-key', kind: 'user' },
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
        eventUrlTransformer: (url: string) =>
          url.replace('http://browserclientintegration.com', 'http://filtered.org'),
      },
      platform,
    );
    await client.start();
    await client.flush();

    // Simulate a click event
    const button = document.createElement('button');
    button.className = 'button';
    document.body.appendChild(button);
    button.click();

    while (platform.requests.fetch.mock.calls.length < 4) {
      // eslint-disable-next-line no-await-in-loop
      await client.flush();
      jest.runAllTicks();
    }

    const events = JSON.parse(platform.requests.fetch.mock.calls[3][1].body);
    const clickEvent = events.find((e: any) => e.kind === 'click');
    expect(clickEvent).toMatchObject({
      kind: 'click',
      creationDate: 1726704000000,
      key: 'click',
      contextKeys: {
        user: 'user-key',
      },
      url: 'http://filtered.org',
    });

    document.body.removeChild(button);
  });

  it('can filter URLs in pageview events', async () => {
    const client = makeClient(
      'client-side-id',
      { key: 'user-key', kind: 'user' },
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
        eventUrlTransformer: (url: string) =>
          url.replace('http://browserclientintegration.com', 'http://filtered.com'),
      },
      platform,
    );

    await client.start();
    await client.flush();

    const events = JSON.parse(platform.requests.fetch.mock.calls[2][1].body);
    const pageviewEvent = events.find((e: any) => e.kind === 'pageview');
    expect(pageviewEvent).toMatchObject({
      kind: 'pageview',
      creationDate: 1726704000000,
      key: 'pageview',
      contextKeys: {
        user: 'user-key',
      },
      url: 'http://filtered.com',
    });
  });

  it('can use bootstrap data', async () => {
    const client = makeClient(
      'client-side-id',
      { kind: 'user', key: 'bob' },
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
      },
      platform,
    );

    await client.start({
      identifyOptions: {
        bootstrap: goodBootstrapDataWithReasons,
      },
    });

    expect(client.jsonVariationDetail('json', undefined)).toEqual({
      reason: {
        kind: 'OFF',
      },
      value: ['a', 'b', 'c', 'd'],
      variationIndex: 1,
    });
  });

  it('can evaluate flags with bootstrap data before identify completes', async () => {
    const client = makeClient(
      'client-side-id',
      { kind: 'user', key: 'bob' },
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
      },
      platform,
    );

    const identifyPromise = client.start({
      identifyOptions: {
        bootstrap: goodBootstrapDataWithReasons,
      },
    });

    const flagValue = client.jsonVariationDetail('json', undefined);
    expect(flagValue).toEqual({
      reason: {
        kind: 'OFF',
      },
      value: ['a', 'b', 'c', 'd'],
      variationIndex: 1,
    });

    expect(client.getContext()).toBeUndefined();

    // Wait for identify to complete
    await identifyPromise;

    // Verify that active context is now set
    expect(client.getContext()).toEqual({ kind: 'user', key: 'bob' });
  });

  it('parses bootstrap data only once when using start()', async () => {
    const bootstrapModule = await import('@launchdarkly/js-client-sdk-common');
    const readFlagsFromBootstrapSpy = jest.spyOn(bootstrapModule, 'readFlagsFromBootstrap');

    const client = makeClient(
      'client-side-id',
      { kind: 'user', key: 'bob' },
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
      },
      platform,
    );

    await client.start({
      identifyOptions: {
        bootstrap: goodBootstrapDataWithReasons,
      },
    });

    expect(readFlagsFromBootstrapSpy).toHaveBeenCalledTimes(1);
    expect(readFlagsFromBootstrapSpy).toHaveBeenCalledWith(
      expect.anything(),
      goodBootstrapDataWithReasons,
    );

    readFlagsFromBootstrapSpy.mockRestore();
  });

  it('uses the latest bootstrap data when identify is called with new bootstrap data', async () => {
    const initialBootstrapData = {
      'string-flag': 'is bob',
      'my-boolean-flag': false,
      $flagsState: {
        'string-flag': {
          variation: 1,
          version: 3,
        },
        'my-boolean-flag': {
          variation: 1,
          version: 11,
        },
      },
      $valid: true,
    };

    const newBootstrapData = {
      'string-flag': 'is alice',
      'my-boolean-flag': true,
      $flagsState: {
        'string-flag': {
          variation: 1,
          version: 4,
        },
        'my-boolean-flag': {
          variation: 0,
          version: 12,
        },
      },
      $valid: true,
    };

    const client = makeClient(
      'client-side-id',
      { kind: 'user', key: 'bob' },
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
      },
      platform,
    );

    await client.start({
      identifyOptions: {
        bootstrap: initialBootstrapData,
      },
    });

    expect(client.stringVariation('string-flag', 'default')).toBe('is bob');
    expect(client.boolVariation('my-boolean-flag', false)).toBe(false);

    await client.identify(
      { kind: 'user', key: 'alice' },
      {
        bootstrap: newBootstrapData,
      },
    );

    expect(client.stringVariation('string-flag', 'default')).toBe('is alice');
    expect(client.boolVariation('my-boolean-flag', false)).toBe(true);
  });

  it('can shed intermediate identify calls', async () => {
    const client = makeClient(
      'client-side-id',
      { key: 'user-key-0', kind: 'user' },
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, sendEvents: false, fetchGoals: false },
      platform,
    );

    const promise0 = client.start();
    const promise1 = client.identify({ key: 'user-key-1', kind: 'user' });
    const promise2 = client.identify({ key: 'user-key-2', kind: 'user' });
    const promise3 = client.identify({ key: 'user-key-3', kind: 'user' });

    const [result0, result1, result2, result3] = await Promise.all([
      promise0,
      promise1,
      promise2,
      promise3,
    ]);

    expect(result0).toEqual({ status: 'complete' });
    expect(result1).toEqual({ status: 'shed' });
    expect(result2).toEqual({ status: 'shed' });
    expect(result3).toEqual({ status: 'completed' });
    // With events and goals disabled the only fetch calls should be for polling requests.
    expect(platform.requests.fetch.mock.calls.length).toBe(2);
  });

  it('calls beforeIdentify in order', async () => {
    const order: string[] = [];
    const client = makeClient(
      'client-side-id',
      { kind: 'user', key: 'user-key-0' },
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
        sendEvents: false,
        fetchGoals: false,
        hooks: [
          {
            beforeIdentify: (hookContext, data) => {
              if ('kind' in hookContext.context && hookContext.context.kind !== 'multi') {
                order.push((hookContext.context as LDSingleKindContext).key);
              }

              return data;
            },
            getMetadata: () => ({
              name: 'test-hook',
              version: '1.0.0',
            }),
          },
        ],
      },
      platform,
    );

    await client.start();

    const promise1 = client.identify({ key: 'user-key-1', kind: 'user' });
    const promise2 = client.identify({ key: 'user-key-2', kind: 'user' });
    const promise3 = client.identify({ key: 'user-key-3', kind: 'user' });

    await Promise.all([promise1, promise2, promise3]);
    expect(order).toEqual(['user-key-0', 'user-key-1', 'user-key-2', 'user-key-3']);
  });

  it('completes identify calls in order', async () => {
    const order: string[] = [];
    const client = makeClient(
      'client-side-id',
      { key: 'user-key-1', kind: 'user' },
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
        sendEvents: false,
        fetchGoals: false,
        hooks: [
          {
            afterIdentify: (hookContext, data, result) => {
              if (result.status === 'shed') {
                return data;
              }
              if ('kind' in hookContext.context && hookContext.context.kind !== 'multi') {
                order.push((hookContext.context as LDSingleKindContext).key);
              }

              return data;
            },
            getMetadata: () => ({
              name: 'test-hook',
              version: '1.0.0',
            }),
          },
        ],
      },
      platform,
    );

    const promise1 = client.start();
    const promise2 = client.identify({ key: 'user-key-2', kind: 'user' });
    const promise3 = client.identify({ key: 'user-key-3', kind: 'user' });

    await Promise.all([promise1, promise2, promise3]);
    // user-key-2 is shed, so it is not included in the order
    expect(order).toEqual(['user-key-1', 'user-key-3']);
  });

  it('completes awaited identify calls in order without shedding', async () => {
    const order: string[] = [];
    const client = makeClient(
      'client-side-id',
      { key: 'user-key-0', kind: 'user' },
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
        sendEvents: false,
        fetchGoals: false,
        hooks: [
          {
            afterIdentify: (hookContext, data, result) => {
              if (result.status === 'shed') {
                return data;
              }
              if ('kind' in hookContext.context && hookContext.context.kind !== 'multi') {
                order.push((hookContext.context as LDSingleKindContext).key);
              }

              return data;
            },
            getMetadata: () => ({
              name: 'test-hook',
              version: '1.0.0',
            }),
          },
        ],
      },
      platform,
    );

    await client.start();

    const result1 = await client.identify({ key: 'user-key-1', kind: 'user' });
    const result2 = await client.identify({ key: 'user-key-2', kind: 'user' });
    const result3 = await client.identify({ key: 'user-key-3', kind: 'user' });

    expect(result1.status).toEqual('completed');
    expect(result2.status).toEqual('completed');
    expect(result3.status).toEqual('completed');

    // user-key-2 is shed, so it is not included in the order
    expect(order).toEqual(['user-key-0', 'user-key-1', 'user-key-2', 'user-key-3']);
  });

  it('can shed intermediate identify calls without waiting for results', async () => {
    const client = makeClient(
      'client-side-id',
      { key: 'user-key-0', kind: 'user' },
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, sendEvents: false, fetchGoals: false },
      platform,
    );

    await client.start();

    const promise1 = client.identify({ key: 'user-key-1', kind: 'user' });
    const promise2 = client.identify({ key: 'user-key-2', kind: 'user' });
    const promise3 = client.identify({ key: 'user-key-3', kind: 'user' });

    await Promise.all([promise1, promise2, promise3]);

    // With events and goals disabled the only fetch calls should be for polling requests.
    expect(platform.requests.fetch.mock.calls.length).toBe(3);
  });

  it('it does not shed non-shedable identify calls', async () => {
    const client = makeClient(
      'client-side-id',
      { key: 'user-key-0', kind: 'user' },
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, sendEvents: false, fetchGoals: false },
      platform,
    );

    await client.start();

    const promise1 = client.identify({ key: 'user-key-1', kind: 'user' }, { sheddable: false });
    const promise2 = client.identify({ key: 'user-key-2', kind: 'user' }, { sheddable: false });
    const promise3 = client.identify({ key: 'user-key-3', kind: 'user' }, { sheddable: false });

    const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

    expect(result1).toEqual({ status: 'completed' });
    expect(result2).toEqual({ status: 'completed' });
    expect(result3).toEqual({ status: 'completed' });
    // With events and goals disabled the only fetch calls should be for polling requests.
    expect(platform.requests.fetch.mock.calls.length).toBe(4);
  });

  it('blocks until the client is ready when waitForInitialization is called', async () => {
    const client = makeClient(
      'client-side-id',
      { key: 'user-key', kind: 'user' },
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, sendEvents: false, fetchGoals: false },
      platform,
    );

    const waitPromise = client.waitForInitialization({ timeout: 10 });
    const startPromise = client.start();

    await Promise.all([waitPromise, startPromise]);

    await expect(waitPromise).resolves.toEqual({ status: 'complete' });
    await expect(startPromise).resolves.toEqual({ status: 'complete' });
  });

  it('resolves waitForInitialization with timeout status when initialization does not complete before the timeout', async () => {
    jest.useRealTimers();

    // Create a platform with a delayed fetch response
    const delayedPlatform = makeBasicPlatform();
    let resolveFetch: (value: any) => void;
    const delayedFetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    // Mock fetch to return a promise that won't resolve until we explicitly resolve it
    delayedPlatform.requests.fetch = jest.fn((_url: string, _options: any) =>
      delayedFetchPromise.then(() => ({})),
    ) as any;

    const client = makeClient(
      'client-side-id',
      { key: 'user-key', kind: 'user' },
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, sendEvents: false, fetchGoals: false },
      delayedPlatform,
    );

    client.start();

    // Call waitForInitialization with a short timeout (0.1 seconds)
    const waitPromise = client.waitForInitialization({ timeout: 0.1 });

    // Verify that waitForInitialization rejects with a timeout error
    await expect(waitPromise).resolves.toEqual({ status: 'timeout' });

    // Clean up: resolve the fetch to avoid hanging promises and restore fake timers
    resolveFetch!({});
    jest.useFakeTimers();
  });

  it('resolves waitForInitialization with failed status immediately when identify fails', async () => {
    const errorPlatform = makeBasicPlatform();
    const identifyError = new Error('Network error');

    // Mock fetch to reject with an error
    errorPlatform.requests.fetch = jest.fn((_url: string, _options: any) =>
      Promise.reject(identifyError),
    ) as any;

    const client = makeClient(
      'client-side-id',
      { key: 'user-key', kind: 'user' },
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, sendEvents: false, fetchGoals: false },
      errorPlatform,
    );

    // Call waitForInitialization first - this creates the promise
    const waitPromise = client.waitForInitialization({ timeout: 10 });

    // Start identify which will fail
    const identifyPromise = client.start();

    await jest.advanceTimersByTimeAsync(4000); // trigger all poll retries

    // Wait for identify to fail
    await expect(identifyPromise).resolves.toEqual({
      status: 'failed',
      error: identifyError,
    });

    // Verify that waitForInitialization returns immediately with failed status
    await expect(waitPromise).resolves.toEqual({
      status: 'failed',
      error: identifyError,
    });
  });

  it('resolves waitForInitialization with failed status when identify fails before waitForInitialization is called', async () => {
    const errorPlatform = makeBasicPlatform();
    const identifyError = new Error('Network error');

    // Mock fetch to reject with an error
    errorPlatform.requests.fetch = jest.fn((_url: string, _options: any) =>
      Promise.reject(identifyError),
    ) as any;

    const client = makeClient(
      'client-side-id',
      { key: 'user-key', kind: 'user' },
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, sendEvents: false, fetchGoals: false },
      errorPlatform,
    );

    // Start identify which will fail BEFORE waitForInitialization is called
    const identifyPromise = client.start();

    await jest.advanceTimersByTimeAsync(4000); // trigger all poll retries

    // Wait for identify to fail
    await expect(identifyPromise).resolves.toEqual({
      status: 'failed',
      error: identifyError,
    });

    // Now call waitForInitialization AFTER identify has already failed
    // It should return the failed status immediately, not timeout
    const waitPromise = client.waitForInitialization({ timeout: 10 });

    // Verify that waitForInitialization returns immediately with failed status
    await expect(waitPromise).resolves.toEqual({
      status: 'failed',
      error: identifyError,
    });
  });

  it('returns the same promise when start is called multiple times', async () => {
    const client = makeClient(
      'client-side-id',
      { kind: 'user', key: 'user-key' },
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, sendEvents: false, fetchGoals: false },
      platform,
    );

    // Call start multiple times before it completes
    const promise1 = client.start();
    const promise2 = client.start();
    const promise3 = client.start();

    // Verify all promises are the same reference
    // The implementation should cache the promise and return the same one
    expect(promise1).toBe(promise2);
    expect(promise2).toBe(promise3);
    expect(promise1).toBe(promise3);

    // Verify all promises resolve to the same value
    const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
    expect(result1.status).toBe('complete');

    // Verify that only one identify call was made (one for polling)
    expect(platform.requests.fetch.mock.calls.length).toBe(1);
  });

  describe('automatic streaming state based on event listeners', () => {
    // streaming must be left undefined so automatic streaming (driven by listener count) can work.
    // streaming: false would force it off permanently; streaming: true would force it on permanently.
    const clientOptions = {
      logger,
      diagnosticOptOut: true,
      sendEvents: false,
      fetchGoals: false,
    };

    it('enables streaming when a generic change listener is added', async () => {
      const { platform: streamingPlatform, eventSourceClose } = makeStreamingPlatform();
      const client = makeClient(
        'client-side-id',
        { key: 'user-key', kind: 'user' },
        AutoEnvAttributes.Disabled,
        clientOptions,
        streamingPlatform,
      );
      await client.start();

      expect(streamingPlatform.requests.createEventSource).not.toHaveBeenCalled();

      client.on('change', jest.fn());

      expect(streamingPlatform.requests.createEventSource).toHaveBeenCalledTimes(1);
      expect(eventSourceClose).not.toHaveBeenCalled();
    });

    it('enables streaming when an individual flag change listener is added', async () => {
      const { platform: streamingPlatform, eventSourceClose } = makeStreamingPlatform();
      const client = makeClient(
        'client-side-id',
        { key: 'user-key', kind: 'user' },
        AutoEnvAttributes.Disabled,
        clientOptions,
        streamingPlatform,
      );
      await client.start();

      expect(streamingPlatform.requests.createEventSource).not.toHaveBeenCalled();

      client.on('change:my-flag', jest.fn());

      expect(streamingPlatform.requests.createEventSource).toHaveBeenCalledTimes(1);
      expect(eventSourceClose).not.toHaveBeenCalled();
    });

    it('disables streaming when the only individual flag change listener is removed', async () => {
      const { platform: streamingPlatform, eventSourceClose } = makeStreamingPlatform();
      const client = makeClient(
        'client-side-id',
        { key: 'user-key', kind: 'user' },
        AutoEnvAttributes.Disabled,
        clientOptions,
        streamingPlatform,
      );
      await client.start();

      const handler = jest.fn();
      client.on('change:my-flag', handler);
      expect(streamingPlatform.requests.createEventSource).toHaveBeenCalledTimes(1);

      client.off('change:my-flag', handler);

      expect(eventSourceClose).toHaveBeenCalled();
    });

    it('keeps streaming active when one of several individual flag listeners is removed', async () => {
      const { platform: streamingPlatform, eventSourceClose } = makeStreamingPlatform();
      const client = makeClient(
        'client-side-id',
        { key: 'user-key', kind: 'user' },
        AutoEnvAttributes.Disabled,
        clientOptions,
        streamingPlatform,
      );
      await client.start();

      const handlerA = jest.fn();
      const handlerB = jest.fn();
      client.on('change:flag-a', handlerA);
      client.on('change:flag-b', handlerB);

      client.off('change:flag-a', handlerA);

      expect(eventSourceClose).not.toHaveBeenCalled();

      client.off('change:flag-b', handlerB);

      expect(eventSourceClose).toHaveBeenCalled();
    });

    it('keeps streaming active when an individual flag listener is removed but a generic change listener remains', async () => {
      const { platform: streamingPlatform, eventSourceClose } = makeStreamingPlatform();
      const client = makeClient(
        'client-side-id',
        { key: 'user-key', kind: 'user' },
        AutoEnvAttributes.Disabled,
        clientOptions,
        streamingPlatform,
      );
      await client.start();

      const genericHandler = jest.fn();
      const flagHandler = jest.fn();
      client.on('change', genericHandler);
      client.on('change:my-flag', flagHandler);

      client.off('change:my-flag', flagHandler);

      expect(eventSourceClose).not.toHaveBeenCalled();
    });

    it('keeps streaming active when the generic change listener is removed but individual flag listeners remain', async () => {
      const { platform: streamingPlatform, eventSourceClose } = makeStreamingPlatform();
      const client = makeClient(
        'client-side-id',
        { key: 'user-key', kind: 'user' },
        AutoEnvAttributes.Disabled,
        clientOptions,
        streamingPlatform,
      );
      await client.start();

      const genericHandler = jest.fn();
      const flagHandler = jest.fn();
      client.on('change', genericHandler);
      client.on('change:my-flag', flagHandler);

      client.off('change', genericHandler);

      expect(eventSourceClose).not.toHaveBeenCalled();
    });
  });

  it('cannot call identify before start', async () => {
    const client = makeClient(
      'client-side-id',
      { kind: 'user', key: 'user-key' },
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, sendEvents: false, fetchGoals: false },
      platform,
    );

    // Call identify before start
    const result = await client.identify({ kind: 'user', key: 'new-user-key' });

    // Verify that identify returns an error status
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('Identify called before start');
    }

    // Verify that the logger was called with the error message
    expect(logger.error).toHaveBeenCalledWith(
      'Client must be started before it can identify a context, did you forget to call start()?',
    );

    // Verify that no fetch calls were made
    expect(platform.requests.fetch.mock.calls.length).toBe(0);
  });
});
