// eslint-disable-next-line import/no-extraneous-dependencies
import { expect, test as it } from '@playwright/test';

it('renders the flag value in white on the toggle-on background color', async ({ page }) => {
  await page.goto('/');

  // The seeded flag data in src/testData.json evaluates sample-feature to true.
  await expect(page.locator('#flag-value')).toHaveText(
    'The sample-feature feature flag evaluates to true.',
    {
      timeout: 10_000,
    },
  );

  // The message is displayed in #FFFFFF.
  await expect(page.locator('#flag-value')).toHaveCSS('color', 'rgb(255, 255, 255)');

  // The background is #00844B because the flag evaluates to true.
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 132, 75)');
});
