import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
    },
    minify: true,
    format: ['esm', 'cjs'],
    splitting: false,
    sourcemap: true,
    clean: true,
    // The public types name Buffer. The dts bundler strips triple-slash
    // directives from source files, so inject the node reference here.
    dts: {
      banner: '/// <reference types="node" />',
    },
    metafile: true,
  },
]);
