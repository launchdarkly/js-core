// eslint-disable-next-line import/no-extraneous-dependencies
import { expect, test as it } from '@playwright/test';

it('evaluates the feature flag to true', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText('feature flag evaluates to true', {
    timeout: 20_000,
  });
});
