import { defineConfig } from 'tsup';
export default defineConfig({
  entry: { index: 'src/sdk.ts' },
  format: ['esm'],
  target: 'esnext',
  clean: true,
  platform: 'node',
  noExternal: ['@launchdarkly/cloudflare-server-sdk'],
  outExtension: () => ({ js: '.mjs' }),
  esbuildOptions(opts) {
    opts.conditions = ['worker', 'browser'];
  },
});
