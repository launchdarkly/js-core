import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
    },
    minify: true,
    format: ['esm', 'cjs'],
    sourcemap: true,
    clean: true,
    dts: true,
    metafile: true,
  },
]);
