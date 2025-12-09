/* eslint-disable import/no-extraneous-dependencies */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'tsdown';

if (fs.existsSync('.env')) {
  loadEnvFile('.env');
}

const ENTRY_FILE = path.join('src', 'app.ts');
const OUTPUT_FILE = path.join('dist', 'app.js');
const { LD_CLIENT_SIDE_ID, LD_FLAG_KEY } = process.env;

const CLIENT_SIDE_ID_PLACEHOLDER = 'LD_CLIENT_SIDE_ID';
const FLAG_KEY_PLACEHOLDER = 'LD_FLAG_KEY';

export default defineConfig({
  entry: ENTRY_FILE,
  platform: 'browser',
  outDir: 'dist',
  noExternal: ['@launchdarkly/js-client-sdk'],
  hooks(hooks) {
    hooks.hook('build:done', () => {
      if (LD_CLIENT_SIDE_ID) {
        const content = fs.readFileSync(OUTPUT_FILE).toString();
        fs.writeFileSync(
          OUTPUT_FILE,
          content.replaceAll(CLIENT_SIDE_ID_PLACEHOLDER, LD_CLIENT_SIDE_ID),
        );
      }
      const flagKey = LD_FLAG_KEY || 'sample-feature';
      const content = fs.readFileSync(OUTPUT_FILE).toString();
      fs.writeFileSync(OUTPUT_FILE, content.replaceAll(FLAG_KEY_PLACEHOLDER, flagKey));
    });
  },
});
