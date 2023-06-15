import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import common from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import generatePackageJson from 'rollup-plugin-generate-package-json';

export default {
  /* Specify main file for EdgeWorker */
  input: 'src/index.ts',

  /* Define output format as an esm module and cjs module and specify the output directory */
  output: [{
    format: 'es',
    sourcemap: true,
    file: 'dist/esm/bundle.es.js',
    intro: 'var setInterval = () => {}; var setTimeout = () => (callback) => { callback(); };',
  },
  {
    format: 'cjs',
    sourcemap: true,
    file: 'dist/cjs/bundle.cjs.js',
    intro: 'var setInterval = () => {}; var setTimeout = () => (callback) => { callback(); };',
  }
],

  /* Bundle all modules into a single output module */
  preserveModules: false,
  external: ['text-encode-transform', 'streams', 'http-request', 'edgekv_tokens.js', 'crypto'],

  plugins: [
    /* Each build output folder cjs and esm needs a package.json */
    generatePackageJson({
      baseContents: (pkg) => ({ ...pkg }),
    }),

    typescript(),

    common({
      transformMixedEsModules: true,
      esmExternals: true,
    }),
    resolve(),
    terser(),
  ],
  onwarn: (warning) => {
    if (warning.code !== 'CIRCULAR_DEPENDENCY') {
      console.error(`(!) ${warning.message}`);
    }
  },
};
