import common from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

// This library is not minified as the final SDK package is responsible for minification.

const getSharedConfig = (format, file) => ({
  input: 'src/index.ts',
  // Intermediate modules don't bundle all dependencies. We leave that to leaf-node
  // SDK implementations.
  external: ['@launchdarkly/js-sdk-common'],
  output: [
    {
      format: format,
      sourcemap: true,
      file: file,
    },
  ],
});

export default [
  {
    ...getSharedConfig('es', 'dist/index.mjs'),
    plugins: [
      typescript({
        module: 'esnext',
        tsconfig: './tsconfig.json',
        outputToFilesystem: true,
      }),
      common({
        transformMixedEsModules: true,
        esmExternals: true,
      }),
      resolve(),
      json(),
    ],
  },
  {
    ...getSharedConfig('cjs', 'dist/index.cjs'),
    plugins: [typescript({ tsconfig: './tsconfig.json' }), common(), resolve(), json()],
  },
];
