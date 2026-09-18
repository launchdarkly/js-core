// It is a dev dependency and the linter doesn't understand.
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'fetch-eventsource': 'src/fetch-eventsource.ts',
  },
  minify: true,
  format: ['esm', 'cjs'],
  splitting: false,
  sourcemap: true,
  clean: true,
  // `@launchdarkly/eventsource` must stay external (the tsup default for a package.json
  // dependency) so mangleProps never rewrites its `_`-prefixed internals.
  noExternal: ['@launchdarkly/js-sdk-common', '@launchdarkly/js-client-sdk-common'],
  dts: true,
  metafile: true,
  esbuildOptions(opts) {
    // This would normally be `^_(?!meta|_)`, but go doesn't support negative look-ahead assertions,
    // so we need to craft something that works without it.
    // So start of line followed by a character that isn't followed by m or underscore, but we
    // want other things that do start with m, so we need to progressively handle more characters
    // of meta with exclusions.
    opts.mangleProps = /^_([^m|_]|m[^e]|me[^t]|met[^a])/;
  },
});
