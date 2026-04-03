import { AutoEnvAttributes, LDLogger } from '@launchdarkly/js-client-sdk-common';

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

  it('can use bootstrap data via start()', async () => {
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

  it('returns the same promise when start is called multiple times', async () => {
    const client = makeClient(
      'client-side-id',
      { kind: 'user', key: 'user-key' },
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, sendEvents: false, fetchGoals: false },
      platform,
    );

    const promise1 = client.start();
    const promise2 = client.start();

    expect(promise1).toBe(promise2);

    const result = await promise1;
    expect(result.status).toBe('complete');
  });

  it('cannot call identify before start', async () => {
    const client = makeClient(
      'client-side-id',
      { kind: 'user', key: 'user-key' },
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, sendEvents: false, fetchGoals: false },
      platform,
    );

    const result = await client.identify({ kind: 'user', key: 'new-user-key' });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.message).toBe('Identify called before start');
    }
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

  it('uses FDv1 endpoints when dataSystem is not set', async () => {
    const client = makeClient(
      'client-side-id',
      { key: 'user-key', kind: 'user' },
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, sendEvents: false, fetchGoals: false },
      platform,
    );

    await client.start();

    const fetchUrl = platform.requests.fetch.mock.calls[0][0];
    expect(fetchUrl).toContain('/sdk/evalx/');
    expect(fetchUrl).not.toContain('/sdk/poll/eval');
  });

  it('uses FDv2 endpoints when dataSystem is set', async () => {
    const client = makeClient(
      'client-side-id',
      { key: 'user-key', kind: 'user' },
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
        sendEvents: false,
        fetchGoals: false,
        // @ts-ignore dataSystem is @internal
        dataSystem: {},
      },
      platform,
    );

    await client.start();

    const fetchUrl = platform.requests.fetch.mock.calls[0][0];
    expect(fetchUrl).toContain('/sdk/poll/eval/');
  });

  it('validates dataSystem options and applies browser defaults', async () => {
    const client = makeClient(
      'client-side-id',
      { key: 'user-key', kind: 'user' },
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
        sendEvents: false,
        fetchGoals: false,
        // @ts-ignore dataSystem is @internal
        dataSystem: { backgroundConnectionMode: 'invalid-mode' },
      },
      platform,
    );

    // Invalid mode should produce a warning
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('dataSystem.backgroundConnectionMode'),
    );

    await client.start();

    // Should still use FDv2 — invalid sub-fields fall back to defaults, not disable FDv2
    const fetchUrl = platform.requests.fetch.mock.calls[0][0];
    expect(fetchUrl).toContain('/sdk/poll/eval/');
  });
});
