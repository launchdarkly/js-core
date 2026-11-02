// eslint-disable-next-line import/no-extraneous-dependencies
import { expect, test as it } from '@playwright/test';

it('evaluates the feature flag to true over a POST stream', async ({ page }) => {
  // The fetch()-based EventSource with usePost streams over POST. The native
  // EventSource cannot do this, so a POST stream request proves the custom
  // transport is in use.
  const postStream = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/sdk/stream/eval'),
    { timeout: 20_000 },
  );

  await page.goto('/');

  await expect(page.locator('body')).toContainText('feature flag evaluates to true', {
    timeout: 20_000,
  });
  await postStream;
});
