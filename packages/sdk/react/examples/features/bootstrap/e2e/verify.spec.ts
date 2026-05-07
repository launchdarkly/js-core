import { expect, test } from '@playwright/test';

test('bootstrapped feature flag value renders on first paint', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('flag-value')).toHaveText(
    /feature flag evaluates to (true|false)\./,
    { timeout: 5000 },
  );
});
