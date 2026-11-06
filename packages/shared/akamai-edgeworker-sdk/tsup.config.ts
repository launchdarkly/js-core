import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  tsconfig: 'tsconfig.build.json',
  format: ['esm', 'cjs'],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  esbuildOptions(options) {
    options.sourcesContent = false;
  },
});
