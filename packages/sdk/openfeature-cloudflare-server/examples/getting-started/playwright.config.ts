// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8787',
  },
  webServer: {
    // `yarn start` is `wrangler dev`, which builds the worker and serves it from
    // Wrangler's local simulated storage on port 8787 by default.
    command: 'yarn start',
    url: 'http://localhost:8787',
    // Building the worker and booting workerd can take longer than Playwright's
    // 60s default allows for on a cold CI runner.
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
