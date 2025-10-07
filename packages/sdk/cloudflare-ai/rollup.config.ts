import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import filesize from 'rollup-plugin-filesize';

const inputPath = 'src/index.ts';
const cjsPath = 'dist/cjs/index.js';
const esmPath = 'dist/esm/index.js';
const typingsPath = 'dist/index.d.ts';

const plugins = [resolve(), commonjs(), esbuild(), json(), terser(), filesize()];

// the second array item is a function to include all js-core packages in the bundle so they
// are not imported or required as separate npm packages
const external = [/node_modules/, (id) => !id.includes('js-core')];

export default [
  {
    input: inputPath,
    output: [
      {
        file: cjsPath,
        format: 'cjs',
        sourcemap: true,
      },
    ],
    plugins,
    external,
  },
  {
    input: inputPath,
    output: [
      {
        file: esmPath,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins,
    external,
  },
  {
    input: inputPath,
    plugins: [dts(), json()],
    output: {
      file: typingsPath,
      format: 'esm',
    },
  },
];
