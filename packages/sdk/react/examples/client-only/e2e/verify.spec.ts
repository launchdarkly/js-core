import { expect, test } from '@playwright/test';

test('feature flag evaluates to true', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('SDK successfully initialized!')).toBeVisible({ timeout: 10000 });

  await expect(page.getByText(`feature flag evaluates to true`, { exact: false })).toBeVisible({
    timeout: 10000,
  });
});
