import {
  AutoEnvAttributes,
  LDLogger,
  LDSingleKindContext,
} from '@launchdarkly/js-client-sdk-common';

import { BrowserClient } from '../src/BrowserClient';
import { makeBasicPlatform } from './BrowserClient.mocks';
import { goodBootstrapDataWithReasons } from './testBootstrapData';

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
    const client = new BrowserClient(
      'client-side-id',
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
      },
      platform,
    );
    await client.identify({ key: 'user-key', kind: 'user' });
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
    const client = new BrowserClient(
      'client-side-id',
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
    await client.identify({ key: 'user-key', kind: 'user' });
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
    const client = new BrowserClient(
      'client-side-id',
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
    await client.identify({ key: 'user-key', kind: 'user' });
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
    const client = new BrowserClient(
      'client-side-id',
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

    await client.identify({ key: 'user-key', kind: 'user' });
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
    const client = new BrowserClient(
      'client-side-id',
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
      },
      platform,
    );
    await client.identify(
      { kind: 'user', key: 'bob' },
      {
        bootstrap: goodBootstrapDataWithReasons,
      },
    );

    expect(client.jsonVariationDetail('json', undefined)).toEqual({
      reason: {
        kind: 'OFF',
      },
      value: ['a', 'b', 'c', 'd'],
      variationIndex: 1,
    });
  });

  it('can shed intermediate identifyResult calls', async () => {
    const client = new BrowserClient(
      'client-side-id',
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, sendEvents: false, fetchGoals: false },
      platform,
    );

    const promise1 = client.identifyResult({ key: 'user-key-1', kind: 'user' });
    const promise2 = client.identifyResult({ key: 'user-key-2', kind: 'user' });
    const promise3 = client.identifyResult({ key: 'user-key-3', kind: 'user' });

    const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

    expect(result1).toEqual({ status: 'completed' });
    expect(result2).toEqual({ status: 'shed' });
    expect(result3).toEqual({ status: 'completed' });
    // With events and goals disabled the only fetch calls should be for polling requests.
    expect(platform.requests.fetch.mock.calls.length).toBe(2);
  });

  it('calls beforeIdentify in order', async () => {
    const order: string[] = [];
    const client = new BrowserClient(
      'client-side-id',
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

    const promise1 = client.identify({ key: 'user-key-1', kind: 'user' });
    const promise2 = client.identify({ key: 'user-key-2', kind: 'user' });
    const promise3 = client.identify({ key: 'user-key-3', kind: 'user' });

    await Promise.all([promise1, promise2, promise3]);
    expect(order).toEqual(['user-key-1', 'user-key-2', 'user-key-3']);
  });

  it('completes identify calls in order', async () => {
    const order: string[] = [];
    const client = new BrowserClient(
      'client-side-id',
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

    const promise1 = client.identify({ key: 'user-key-1', kind: 'user' });
    const promise2 = client.identify({ key: 'user-key-2', kind: 'user' });
    const promise3 = client.identify({ key: 'user-key-3', kind: 'user' });

    await Promise.all([promise1, promise2, promise3]);
    // user-key-2 is shed, so it is not included in the order
    expect(order).toEqual(['user-key-1', 'user-key-3']);
  });

  it('can shed intermediate identify calls', async () => {
    const client = new BrowserClient(
      'client-side-id',
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, sendEvents: false, fetchGoals: false },
      platform,
    );

    const promise1 = client.identify({ key: 'user-key-1', kind: 'user' });
    const promise2 = client.identify({ key: 'user-key-2', kind: 'user' });
    const promise3 = client.identify({ key: 'user-key-3', kind: 'user' });

    await Promise.all([promise1, promise2, promise3]);

    // With events and goals disabled the only fetch calls should be for polling requests.
    expect(platform.requests.fetch.mock.calls.length).toBe(2);
  });

  it('it does not shed non-shedable identify calls', async () => {
    const client = new BrowserClient(
      'client-side-id',
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, sendEvents: false, fetchGoals: false },
      platform,
    );

    const promise1 = client.identifyResult(
      { key: 'user-key-1', kind: 'user' },
      { sheddable: false },
    );
    const promise2 = client.identifyResult(
      { key: 'user-key-2', kind: 'user' },
      { sheddable: false },
    );
    const promise3 = client.identifyResult(
      { key: 'user-key-3', kind: 'user' },
      { sheddable: false },
    );

    const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

    expect(result1).toEqual({ status: 'completed' });
    expect(result2).toEqual({ status: 'completed' });
    expect(result3).toEqual({ status: 'completed' });
    // With events and goals disabled the only fetch calls should be for polling requests.
    expect(platform.requests.fetch.mock.calls.length).toBe(3);
  });
});
