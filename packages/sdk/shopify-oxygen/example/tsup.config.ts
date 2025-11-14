// It is a dev dependency and the linter doesn't understand.
// @ts-ignore - tsup is a dev dependency installed at runtime
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  minify: true,
  format: ['esm'],
  splitting: false,
  clean: true,
  noExternal: ['@launchdarkly/shopify-oxygen-sdk'],
  dts: true,
});
