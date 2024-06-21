import common from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import generatePackageJson from 'rollup-plugin-generate-package-json';

const getSharedConfig = (format, file) => ({
  input: 'src/index.ts',
  output: [
    {
      format: format,
      sourcemap: true,
      file: file,
    },
  ],
  onwarn: (warning) => {
    if (warning.code !== 'CIRCULAR_DEPENDENCY') {
      console.error(`(!) ${warning.message}`);
    }
  },
});

export default [
  {
    ...getSharedConfig('es', 'dist/esm/bundle.es.js'),
    plugins: [
      generatePackageJson({
        baseContents: (pkg) => ({
          name: pkg.name,
          version: pkg.version,
          type: 'module',
        }),
      }),
      typescript({
        module: 'esnext',
      }),
      common({
        transformMixedEsModules: true,
        esmExternals: true,
      }),
      resolve(),
      terser(),
    ],
  },
  {
    ...getSharedConfig('cjs', 'dist/cjs/bundle.cjs.js'),
    plugins: [
      generatePackageJson({
        baseContents: (pkg) => ({
          name: pkg.name,
          version: pkg.version,
          type: 'commonjs',
        }),
      }),
      typescript(),
      common(),
      resolve(),
      terser(),
    ],
  },
];
