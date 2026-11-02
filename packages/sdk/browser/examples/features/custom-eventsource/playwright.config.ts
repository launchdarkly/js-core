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
    command: 'npx http-server . -p 4173 --silent',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
