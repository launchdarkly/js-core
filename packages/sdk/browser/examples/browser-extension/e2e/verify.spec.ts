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

function isStreamRequest(request: Request): boolean {
  return request.url().includes('clientstream.launchdarkly.com/eval/');
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
      if (isStreamRequest(request)) {
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

  // A service worker has no native EventSource. A stream request from the worker proves that
  // the fetch()-based EventSource is in use.
  await expect.poll(() => streamRequests.length, { timeout: 20_000 }).toBeGreaterThan(0);
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
