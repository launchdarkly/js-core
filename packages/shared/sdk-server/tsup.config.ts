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
  dts: true,
  // The default sourcemap inlines every original source file's full text
  // (sourcesContent), which roughly doubles map size for a bundle this large.
  // Line/column mapping still works without it; only inline source preview
  // in a debugger is lost, and that preview never worked for consumers of the
  // published package anyway since src/ is not part of the npm package.
  esbuildOptions(options) {
    options.sourcesContent = false;
  },
});
