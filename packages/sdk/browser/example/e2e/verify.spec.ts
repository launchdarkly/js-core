// eslint-disable-next-line import/no-extraneous-dependencies
import { expect, test } from '@playwright/test';

test('feature flag evaluates to true', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText('feature flag evaluates to true', {
    timeout: 20_000,
  });
});
