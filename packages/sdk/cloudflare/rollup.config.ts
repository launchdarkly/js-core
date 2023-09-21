/* eslint-disable import/no-extraneous-dependencies */
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { loadJsonFileSync } from 'load-json-file';
import { OutputOptions } from 'rollup';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import filesize from 'rollup-plugin-filesize';
import { writeJsonFileSync } from 'write-json-file';

const cjsIndex = 'dist/cjs/src/index.js';
const cjsPackageJson = 'dist/cjs/package.json';
const esmIndex = 'dist/esm/src/index.js';
const esmPackageJson = 'dist/esm/package.json';

function injectPackageJson() {
  return {
    name: 'inject-package-json',
    generateBundle({ format }: OutputOptions) {
      const { name, version } = loadJsonFileSync('package.json') as any;
      const minimalPackageJson = {
        name,
        version,
        type: format === 'cjs' ? 'commonjs' : 'module',
      };

      const packageJsonPath = format === 'cjs' ? cjsPackageJson : esmPackageJson;
      writeJsonFileSync(packageJsonPath, minimalPackageJson, {
        indent: 2,
      });
    },
  };
}

const plugins = [
  resolve(),
  commonjs(),
  esbuild(),
  json(),
  terser(),
  filesize(),
  injectPackageJson(),
];

// the second array item is a function to include all js-core packages in the bundle so they
// are not imported or required as separate npm packages
const external = [/node_modules/, (id: string) => !id.includes('js-core')];

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: cjsIndex,
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
        file: esmIndex,
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
