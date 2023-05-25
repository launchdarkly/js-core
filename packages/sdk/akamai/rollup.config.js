import alias from '@rollup/plugin-alias';

export default {
  /* Specify main file for EdgeWorker */
  input: 'src/index.ts',

  /* Define output format as an esm module and cjs module and specify the output directory */
  output: [
    {
      format: 'esm',
      dir: "dist/esm/",
    },
    {
      format: 'cjs',
      dir: "dist/cjs/",
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
  ],
};
