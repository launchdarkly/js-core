// import { build } from 'esbuild';
// import { Generator } from 'npm-dts';
// import { dependencies, peerDependencies } from './package.json';
//
// new Generator({
//   entry: 'src/index.ts',
//   output: 'dist/index.d.ts',
// }).generate();
//
// const sharedConfig = {
//   entryPoints: ['src/index.ts'],
//   bundle: true,
//   minify: true,
//   sourcemap: true,
//   external: Object.keys(dependencies).concat(Object.keys(peerDependencies)),
// };
//
// build({
//   ...sharedConfig,
//   platform: 'node', // for CJS
//   outfile: 'dist/index.js',
// });
//
// build({
//   ...sharedConfig,
//   outfile: 'dist/index.esm.js',
//   platform: 'neutral', // for ESM
//   format: 'esm',
// });
