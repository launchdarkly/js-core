// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'yarn start',
    port: 3000,
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
  },
});
