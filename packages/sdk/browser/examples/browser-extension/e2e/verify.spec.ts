// eslint-disable-next-line import/no-extraneous-dependencies
import {
  type BrowserContext,
  chromium,
  expect,
  type Request,
  test as base,
  type Worker,
} from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The native EventSource and the fetch()-based one use the same stream URL. Only a request of
// resource type 'fetch' comes from the fetch()-based EventSource.
function isFetchStreamRequest(request: Request): boolean {
  return (
    request.url().includes('clientstream.launchdarkly.com/eval/') &&
    request.resourceType() === 'fetch'
  );
}

interface Fixtures {
  context: BrowserContext;
  streamRequests: Request[];
  serviceWorker: Worker;
  extensionId: string;
}

// Chrome loads an unpacked extension only into a persistent context, so each test gets its own.
const it = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  streamRequests: async ({}, use) => {
    await use([]);
  },
  context: async ({ streamRequests }, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    // The worker starts when the extension loads, and it can open the stream before the test
    // body runs. Record stream requests from the start, so the test cannot miss one.
    context.on('request', (request) => {
      if (isFetchStreamRequest(request)) {
        streamRequests.push(request);
      }
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const [worker] = context.serviceWorkers();
    await use(worker ?? (await context.waitForEvent('serviceworker')));
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

it('shows the flag value in the popup and streams from the service worker', async ({
  context,
  extensionId,
  streamRequests,
}) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(popup.locator('#flag')).toContainText('feature flag evaluates to true', {
    timeout: 20_000,
  });

  await expect.poll(() => streamRequests.length, { timeout: 20_000 }).toBeGreaterThan(0);
  const streamResponse = await streamRequests[0].response();
  expect(streamResponse?.status()).toBe(200);
});

it('answers GET_FLAG and caches the flags in chrome.storage.local', async ({
  context,
  extensionId,
  serviceWorker,
}) => {
  // Send GET_FLAG directly. A broadcast from the worker cannot satisfy this check, so it tests
  // the response path.
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  const response = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_FLAG' }));
  expect(response).toMatchObject({ type: 'FLAG_VALUE', value: true });

  const stored = await serviceWorker.evaluate(() => chrome.storage.local.get(null));
  expect(Object.keys(stored).some((key) => key.startsWith('LaunchDarkly_'))).toBe(true);
});

it('sends the flag value to content scripts', async ({ context }) => {
  const page = await context.newPage();
  const logged = page.waitForEvent('console', {
    predicate: (message) => message.text().includes('feature flag evaluates to true'),
    timeout: 20_000,
  });
  await page.goto('/');
  await logged;
});
