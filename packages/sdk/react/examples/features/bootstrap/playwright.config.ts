// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3001',
  },
  webServer: {
    command: 'yarn start',
    port: 3001,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});
