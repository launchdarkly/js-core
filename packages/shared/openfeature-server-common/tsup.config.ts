// It is a dev dependency and the linter doesn't understand.
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm', 'cjs'],
  splitting: false,
  sourcemap: true,
  clean: true,
  // DTS is generated via tsc instead of rollup-dts because @openfeature/server-sdk
  // re-exports from @openfeature/core as a peer dependency which confuses the DTS rollup.
  dts: false,
});
