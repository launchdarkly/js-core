// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'yarn preview',
    port: 4173,
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
  },
});
