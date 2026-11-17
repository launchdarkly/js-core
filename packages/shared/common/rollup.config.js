import common from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

// The common library does not have a dependency resolution plugin as it should not have any
// dependencies.

// This library is not minified as the final SDK package is responsible for minification.

// Remove comments from the JavaScript output only. Do not use the TypeScript removeComments
// option. It also removes the JSDoc comments from the declaration files.
const stripComments = () =>
  terser({ compress: false, mangle: false, format: { comments: false, beautify: true } });

const getSharedConfig = (format, file) => ({
  input: 'src/index.ts',
  output: [
    {
      format: format,
      sourcemap: true,
      file: file,
    },
  ],
});

export default [
  {
    ...getSharedConfig('es', 'dist/esm/index.mjs'),
    plugins: [
      typescript({
        module: 'esnext',
        tsconfig: './tsconfig.json',
        outputToFilesystem: true,
      }),
      common({
        transformMixedEsModules: true,
        esmExternals: true,
      }),
      json(),
      stripComments(),
    ],
  },
  {
    ...getSharedConfig('cjs', 'dist/cjs/index.cjs'),
    plugins: [
      typescript({ tsconfig: './tsconfig.json', outputToFilesystem: true }),
      common(),
      json(),
      stripComments(),
    ],
  },
];
