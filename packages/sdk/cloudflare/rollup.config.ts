import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import filesize from 'rollup-plugin-filesize';

const inputPath = 'src/index.ts';
const cjsPath = 'dist/cjs/index.js';
const esmPath = 'dist/esm/index.js';

// the second array item is a function to include all js-core packages in the bundle so they
// are not imported or required as separate npm packages
const external = [
  // @rollup/plugin-typescript needs tslib bundled, so exclude it from the node_modules external pattern.
  /node_modules(?!.*tslib)/,
  (id: string) => !id.includes('js-core'),
];

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
    plugins: [
      resolve(),
      commonjs(),
      typescript({ declaration: false, declarationMap: false }),
      json(),
      terser(),
      filesize(),
    ],
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
    plugins: [
      resolve(),
      commonjs(),
      typescript({ declaration: true, declarationDir: 'dist/esm' }),
      json(),
      terser(),
      filesize(),
    ],
    external,
  },
];
