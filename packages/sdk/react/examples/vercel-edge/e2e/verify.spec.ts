import { expect, test } from '@playwright/test';

test('feature flag evaluates to true', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('feature flag evaluates to true', { exact: false })).toHaveCount(2, {
    timeout: 10000,
  });
});
