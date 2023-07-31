import common from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';

const OUT_DIR = 'dist/ew';

export default {
  /* Specify main file for EdgeWorker */
  input: 'main.ts',

  /* Define external modules, which will be provided by the EdgeWorker platform */
  external: ['url-search-params', 'log'],

  /* Define output format as an ES module and specify the output directory */
  output: {
    format: 'es',
    dir: OUT_DIR,
  },

  /* Bundle all modules into a single output module */
  preserveModules: false,
  plugins: [
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
            contents.toString().replace('__VERSION__', process.env.npm_package_version),
        },
      ],
    }),
  ],
};
