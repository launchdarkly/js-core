import common from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const getSharedConfig = (format, file) => ({
  input: 'src/index.ts',
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
    ...getSharedConfig('es', 'dist/index.es.js'),
    plugins: [
      typescript({
        module: 'esnext',
      }),
      common({
        transformMixedEsModules: true,
        esmExternals: true,
      }),
      resolve(),
      terser(),
      json(),
    ],
  },
  {
    ...getSharedConfig('cjs', 'dist/index.cjs.js'),
    plugins: [typescript(), common(), resolve(), terser(), json()],
  },
];
