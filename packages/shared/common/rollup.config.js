import common from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';

// The common library does not have a dependency resolution plugin as it should not have any
// dependencies.

// This library is not minified as the final SDK package is responsible for minification.

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
    ],
  },
  {
    ...getSharedConfig('cjs', 'dist/cjs/index.cjs'),
    plugins: [typescript({ tsconfig: './tsconfig.json', outputToFilesystem: true, }), common(), json()],
  },
];
