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

const external = ['@cloudflare/workers-types', 'crypto-js', 'semver', '@types/semver'];

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
    plugins: [dts({ respectExternal: true }), json()],
    output: {
      file: typingsPath,
      format: 'esm',
    },
    external,
  },
];
