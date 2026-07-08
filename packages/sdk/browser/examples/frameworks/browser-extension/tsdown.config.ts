/* eslint-disable import/no-extraneous-dependencies */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'tsdown';

// .env is optional (see .env.template); loadEnvFile throws if the file is
// missing, so guard it instead of letting a fresh checkout fail the build.
if (fs.existsSync('.env')) {
  loadEnvFile('.env');
}

const { LAUNCHDARKLY_CLIENT_SIDE_ID, LAUNCHDARKLY_FLAG_KEY } = process.env;

const CLIENT_SIDE_ID_PLACEHOLDER = 'LD_CLIENT_SIDE_ID';
const FLAG_KEY_PLACEHOLDER = 'LD_FLAG_KEY';
const BACKGROUND_OUTPUT = path.join('dist', 'background.js');

export default defineConfig({
  entry: {
    background: path.join('src', 'background.ts'),
    popup: path.join('src', 'popup', 'popup.ts'),
    'content-script': path.join('src', 'content-script.ts'),
  },
  platform: 'browser',
  format: 'esm',
  outDir: 'dist',
  // Extension contexts load these files directly with no bundler or
  // node_modules resolution available at runtime, so the SDK must be inlined.
  noExternal: ['@launchdarkly/js-client-sdk'],
  hooks(hooks) {
    // Substituting into the compiled output (rather than baking env vars in at
    // compile time) keeps the placeholders as plain string literals in source,
    // so background.ts never needs the env vars set to type-check or run in tests.
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
});
