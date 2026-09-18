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
const { LAUNCHDARKLY_CLIENT_SIDE_ID, LAUNCHDARKLY_FLAG_KEY } = process.env;

const CLIENT_SIDE_ID_PLACEHOLDER = 'LD_CLIENT_SIDE_ID';
const FLAG_KEY_PLACEHOLDER = 'LD_FLAG_KEY';

export default defineConfig({
  entry: ENTRY_FILE,
  platform: 'browser',
  outDir: 'dist',
  // The fetch-eventsource subpath needs its own entry here -- noExternal matches by exact
  // specifier, not by package prefix, so listing only the package root would leave this
  // subpath's `import` unbundled in the output, which a plain `<script>` tag cannot resolve.
  noExternal: ['@launchdarkly/js-client-sdk', '@launchdarkly/js-client-sdk/fetch-eventsource'],
  hooks(hooks) {
    hooks.hook('build:done', () => {
      if (LAUNCHDARKLY_CLIENT_SIDE_ID) {
        const content = fs.readFileSync(OUTPUT_FILE).toString();
        fs.writeFileSync(
          OUTPUT_FILE,
          content.replaceAll(CLIENT_SIDE_ID_PLACEHOLDER, LAUNCHDARKLY_CLIENT_SIDE_ID),
        );
      }
      const flagKey = LAUNCHDARKLY_FLAG_KEY || 'sample-feature';
      const content = fs.readFileSync(OUTPUT_FILE).toString();
      fs.writeFileSync(OUTPUT_FILE, content.replaceAll(FLAG_KEY_PLACEHOLDER, flagKey));
    });
  },
});
