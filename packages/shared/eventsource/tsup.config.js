import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
    },
    tsconfig: 'tsconfig.build.json',
    minify: true,
    format: ['esm', 'cjs'],
    sourcemap: true,
    clean: true,
    dts: true,
    metafile: true,
  },
]);
