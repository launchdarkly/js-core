// eslint-disable-next-line import/no-extraneous-dependencies
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

test('feature flag evaluates to true', async () => {
  let output = '';

  // Use a fresh user data directory for each run so Electron's HTTP cache and the
  // LaunchDarkly SDK's file-based flag cache cannot return stale values from a
  // previous run with a different mobile key.
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ld-electron-verify-'));

  try {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../.vite/build/main.js'), `--user-data-dir=${userDataDir}`],
      env: {
        ...process.env,
        CI: 'true',
        DISPLAY: process.env.DISPLAY ?? ':99',
      },
    });

    electronApp.process().stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    await new Promise<void>((resolve) => {
      electronApp.on('close', resolve);
    });

    process.stdout.write(output);

    expect(output).toContain('feature flag evaluates to true');
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
