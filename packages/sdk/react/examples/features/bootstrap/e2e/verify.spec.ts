import { expect, test } from '@playwright/test';

test('renders the bootstrapped flag value without LaunchDarkly network access', async ({ page }) => {
  // Block every LaunchDarkly request so the browser SDK cannot fetch flags on its own.
  // The only way the page can render the real flag value is via the server-provided bootstrap payload.
  await page.route(/launchdarkly\.(com|us)/, (route) => route.abort());

  await page.goto('/');

  await expect(page.getByText('feature flag evaluates to true', { exact: false })).toBeVisible({
    timeout: 10_000,
  });
});
