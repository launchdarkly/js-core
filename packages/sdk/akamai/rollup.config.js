import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import common from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';
import alias from '@rollup/plugin-alias';

const OUT_DIR = 'dist';
const VERSION = '0.0.1' // {x-release-please-version}

export default {
  /* Specify main file for EdgeWorker */
  input: 'src/index.ts',

  /* Define external modules, which will be provided by the EdgeWorker platform */
  external: ['url-search-params', 'log'],

  /* Define output format as an ES module and specify the output directory */
  output: [
    {
      format: 'esm',
      dir: OUT_DIR,
    },
    {
      format: 'cjs',
      dir: OUT_DIR,
    },
  ],

  /* Bundle all modules into a single output module */
  preserveModules: false,
  plugins: [
    alias({
      entries: [
        {
          find: 'node:events',
          replacement: 'rollup-plugin-node-polyfills/polyfills/events',
        },
        {
          find: 'node:timers',
          replacement: 'rollup-plugin-node-polyfills/polyfills/timers',
        },
      ],
    }),

    /* Convert to Typescript */
    typescript(),

    /* Resolve modules from node_modules */
    resolve(),

    /* Convert commonJS modules */
    common(),

    /* Copy bundle.json to the output directory */
    copy({
      assets: ['./bundle.json'],
      targets: [
        {
          src: './bundle.json',
          dest: OUT_DIR,
          transform: (contents) =>
            contents.toString().replace('__VERSION__', VERSION),
        },
      ],
    }),
  ],
};
