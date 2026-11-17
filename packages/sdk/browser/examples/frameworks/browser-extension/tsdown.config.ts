/* eslint-disable import/no-extraneous-dependencies */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'tsdown';

if (fs.existsSync('.env')) {
  loadEnvFile('.env');
}

const BACKGROUND_OUTPUT = path.join('dist', 'background.js');
const { LAUNCHDARKLY_CLIENT_SIDE_ID, LAUNCHDARKLY_FLAG_KEY } = process.env;

const CLIENT_SIDE_ID_PLACEHOLDER = 'LD_CLIENT_SIDE_ID';
const FLAG_KEY_PLACEHOLDER = 'LD_FLAG_KEY';

export default defineConfig([
  {
    entry: {
      background: path.join('src', 'background.ts'),
      popup: path.join('src', 'popup', 'popup.ts'),
    },
    platform: 'browser',
    format: 'esm',
    outDir: 'dist',
    // The build script removes dist first. Both builds write to dist, so neither one cleans it.
    clean: false,
    // Chrome loads these files directly, so the SDK must be in the bundle. noExternal matches the
    // exact specifier, so the fetch-eventsource subpath needs its own entry.
    noExternal: ['@launchdarkly/js-client-sdk', '@launchdarkly/js-client-sdk/fetch-eventsource'],
    hooks(hooks) {
      hooks.hook('build:done', () => {
        let content = fs.readFileSync(BACKGROUND_OUTPUT).toString();
        if (LAUNCHDARKLY_CLIENT_SIDE_ID) {
          content = content.replaceAll(CLIENT_SIDE_ID_PLACEHOLDER, LAUNCHDARKLY_CLIENT_SIDE_ID);
        }
        const flagKey = LAUNCHDARKLY_FLAG_KEY || 'sample-feature';
        content = content.replaceAll(FLAG_KEY_PLACEHOLDER, flagKey);
        fs.writeFileSync(BACKGROUND_OUTPUT, content);
      });
    },
  },
  {
    // Chrome loads a content script as a classic script, which cannot use import. A separate IIFE
    // build makes sure that no shared chunk import goes into this file.
    entry: { 'content-script': path.join('src', 'content-script.ts') },
    platform: 'browser',
    format: 'iife',
    outDir: 'dist',
    clean: false,
  },
]);
