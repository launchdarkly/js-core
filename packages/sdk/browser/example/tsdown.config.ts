/* eslint-disable import/no-extraneous-dependencies */
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'src/app.ts',
  platform: 'browser',
  outDir: 'dist',
  noExternal: ['@launchdarkly/js-client-sdk'],
});
