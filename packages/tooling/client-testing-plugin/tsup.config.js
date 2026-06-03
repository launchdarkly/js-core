import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      'index': 'src/index.ts',
      'clients/js-client-sdk': 'src/clients/js-client-sdk.ts',
      'clients/react-sdk': 'src/clients/react-sdk.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    minify: false,
  },
]);
