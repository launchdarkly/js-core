import { AutoEnvAttributes, LDLogger } from '@launchdarkly/js-client-sdk-common';

import { makeClient } from '../src/BrowserClient';
import { makeBasicPlatform } from './BrowserClient.mocks';

const logger: LDLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

function eventPosts(platform: any): any[] {
  return platform.requests.fetch.mock.calls.filter(([url]: [string]) =>
    url.includes('/events/bulk/'),
  );
}

async function settle() {
  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });
}

describe('given a browser client with goals disabled', () => {
  let platform: any;
  let client: ReturnType<typeof makeClient>;

  beforeEach(async () => {
    Object.defineProperty(window, 'location', {
      value: { href: 'http://browserclientintegration.com' },
      writable: true,
    });
    platform = makeBasicPlatform();
    client = makeClient(
      'client-side-id',
      { key: 'user-key', kind: 'user' },
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true, fetchGoals: false },
      platform,
    );
    await client.start();
  });

  afterEach(async () => {
    await client.close();
  });

  it('flushes with keepalive when the page is hidden', async () => {
    await client.flush();
    const before = eventPosts(platform).length;
    client.track('metric');

    window.dispatchEvent(new Event('pagehide'));
    await settle();

    const posts = eventPosts(platform);
    expect(posts.length).toBe(before + 1);
    expect(posts[posts.length - 1][1].keepalive).toBe(true);
  });
});

describe('given a browser client with background handling disabled', () => {
  let platform: any;
  let client: ReturnType<typeof makeClient>;

  beforeEach(async () => {
    platform = makeBasicPlatform();
    client = makeClient(
      'client-side-id',
      { key: 'user-key', kind: 'user' },
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
        fetchGoals: false,
        automaticBackgroundHandling: false,
      },
      platform,
    );
    await client.start();
  });

  afterEach(async () => {
    await client.close();
  });

  it('does not flush when the page is hidden', async () => {
    await client.flush();
    const before = eventPosts(platform).length;
    client.track('metric');

    window.dispatchEvent(new Event('pagehide'));
    await settle();

    expect(eventPosts(platform).length).toBe(before);
  });
});

describe('given a closed browser client', () => {
  let platform: any;
  let client: ReturnType<typeof makeClient>;
  let removeEventListener: jest.SpyInstance;

  beforeEach(async () => {
    removeEventListener = jest.spyOn(window, 'removeEventListener');
    platform = makeBasicPlatform();
    client = makeClient(
      'client-side-id',
      { key: 'user-key', kind: 'user' },
      AutoEnvAttributes.Disabled,
      { streaming: false, logger, diagnosticOptOut: true },
      platform,
    );
    await client.start();
    await client.close();
  });

  afterEach(() => {
    removeEventListener.mockRestore();
  });

  it('does not flush when the page is hidden', async () => {
    const before = eventPosts(platform).length;
    // Queue an event after close, so a leaked listener would have something to post.
    client.track('metric');

    window.dispatchEvent(new Event('pagehide'));
    await settle();

    expect(eventPosts(platform).length).toBe(before);
  });

  it('removes the page and location listeners', () => {
    const removed = removeEventListener.mock.calls.map(([type]) => type);
    expect(removed).toContain('pagehide');
    expect(removed).toContain('popstate');
  });

  it('can be closed a second time', async () => {
    await expect(client.close()).resolves.toBeUndefined();
  });
});
