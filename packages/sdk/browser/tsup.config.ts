// It is a dev dependency and the linter doesn't understand.
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    compat: 'src/compat/index.ts'
  },
  minify: 'terser',
  terserOptions: {
    mangle: {
      properties: {
        // Mangle class properties which start with an underscore.
        regex: /^_/,
        // Do not mangle '_meta', because this is part of our JSON
        // data model.
        reserved: ['_meta'],
      },
    },
  },
  format: ['esm', 'cjs'],
  splitting: false,
  sourcemap: false,
  clean: true,
  noExternal: ['@launchdarkly/js-sdk-common', '@launchdarkly/js-client-sdk-common'],
  treeshake: true,
  dts: true,
});
