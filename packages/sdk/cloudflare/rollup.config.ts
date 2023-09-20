/* eslint-disable import/no-extraneous-dependencies */
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import filesize from 'rollup-plugin-filesize';
import generatePackageJson from 'rollup-plugin-generate-package-json';

type PackageType = 'commonjs' | 'module';
const basePlugins = [resolve(), commonjs(), esbuild(), json(), terser(), filesize()];
const generatePlugins = (type: PackageType) =>
  basePlugins.concat([
    generatePackageJson({
      baseContents: ({ name, version }: any) => ({
        name,
        version,
        type,
      }),
      outputFolder: type === 'commonjs' ? 'dist/cjs' : 'dist/esm',
    }),
  ]);

const external = [/node_modules/, (id: string) => !id.includes('js-core')];

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
    plugins: generatePlugins('commonjs'),
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
    plugins: generatePlugins('module'),
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
