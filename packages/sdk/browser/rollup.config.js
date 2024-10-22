import common from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import { visualizer } from 'rollup-plugin-visualizer';

const getSharedConfig = (format, extension) => ({
  input: {
    index: 'src/index.ts',
    compat: 'src/compat/index.ts'
  },
  output:
  {
    format: format,
    sourcemap: true,
    dir: 'dist',
    entryFileNames: '[name]' + extension
  },
});

const terserOpts = {
  mangle: {
    properties: {
      // Mangle class properties which start with an underscore.
      regex: /^_/,
      // Do not mangle '_meta', because this is part of our JSON
      // data model.
      reserved: ['_meta'],
    },
  },
};

export default [
  {
    ...getSharedConfig('es', '.es.js'),
    plugins: [
      typescript({
        module: 'esnext',
      }),
      common({
        transformMixedEsModules: true,
        esmExternals: true,
      }),
      resolve(),
      terser(terserOpts),
      json(),
      // The 'sourcemap' option allows using the minified size, not the size before minification.
      visualizer({ sourcemap: true }),
    ],
  },
  {
    ...getSharedConfig('cjs', '.cjs.js'),
    plugins: [typescript(), common(), resolve(), terser(terserOpts), json()],
  },
];
