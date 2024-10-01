import common from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { visualizer } from "rollup-plugin-visualizer";

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
  onwarn: (warning) => {
    if (warning.code !== 'CIRCULAR_DEPENDENCY') {
      console.error(`(!) ${warning.message}`);
    }
  },
});

export default [
  {
    ...getSharedConfig('es', 'dist/index.es.js'),
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
      // The 'sourcemap' option allows using the minified size, not the size before minification.
      visualizer({ sourcemap: true }),
    ],
  },
  {
    ...getSharedConfig('cjs', 'dist/index.cjs.js'),
    plugins: [typescript({ tsconfig: './tsconfig.json' }), common(), resolve(), json()],
  },
];
