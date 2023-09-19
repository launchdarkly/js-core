import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import filesize from 'rollup-plugin-filesize';

const copyToDist = copy({
  targets: [{ src: 'package.json', dest: ['dist/cjs', 'dist/esm'] }],
  verbose: true,
});
const plugins = [resolve(), esbuild(), json(), terser(), filesize(), copyToDist];
const external = [/node_modules/, /shared/];

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/cjs/src/index.js',
        format: 'cjs',
        sourcemap: true,
      },
    ],
    plugins,
    external,
  },
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/esm/src/index.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins,
    external,
  },
  {
    input: 'src/index.ts',
    plugins: [dts(), json()],
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
  },
];
