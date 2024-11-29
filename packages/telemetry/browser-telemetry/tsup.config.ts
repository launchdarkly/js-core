// It is a dev dependency and the linter doesn't understand.
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  minify: true,
  format: ['esm', 'cjs'],
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: true,
  metafile: false,
});
