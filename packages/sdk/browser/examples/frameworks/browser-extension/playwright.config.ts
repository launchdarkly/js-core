// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4174',
  },
  // A plain page for the content script to run on.
  webServer: {
    command: 'npx http-server ./e2e/site -p 4174 --silent',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
  },
});
