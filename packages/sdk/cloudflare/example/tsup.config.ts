// It is a dev dependency and the linter doesn't understand.
// @ts-ignore - tsup is a dev dependency installed at runtime
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  target: 'esnext',
  sourcemap: true,
  clean: true,
  platform: 'node',
  external: ['__STATIC_CONTENT_MANIFEST'],
  noExternal: ['@launchdarkly/cloudflare-server-sdk'],
  outExtension: () => ({ js: '.mjs' }),
  esbuildOptions(opts) {
    opts.conditions = ['worker', 'browser'];
  },
});
