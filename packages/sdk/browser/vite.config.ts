/* eslint-disable import/no-extraneous-dependencies */
// This file intentionally uses dev dependencies as it is a build file.
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: '@launchdarkly/js-client-sdk',
      fileName: (format) => `index.${format}.js`,
      formats: ['cjs', 'es'],
    },
    rollupOptions: {},
  },
});
