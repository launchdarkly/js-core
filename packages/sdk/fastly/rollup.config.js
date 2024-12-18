import common from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import generatePackageJson from 'rollup-plugin-generate-package-json';
import nodePolyfills from 'rollup-plugin-node-polyfills';

const getSharedConfig = (format, file) => ({
  input: 'src/index.ts',
  output: [
    {
      format: format,
      sourcemap: true,
      file: file,
      preserveModules: false,
    },
  ],
  external: ['node:events'],
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
      replace({
        preventAssignment: true,
        values: {
          'node:events': 'events',
          'from "node:events"': 'from "events"',
          "from 'node:events'": "from 'events'",
        },
      }),
      resolve({
        preferBuiltins: false,
        browser: true,
        mainFields: ['browser', 'module', 'main'],
      }),
      common({
        transformMixedEsModules: true,
        esmExternals: true,
      }),
      nodePolyfills({
        include: ['events'],
      }),
      typescript({
        module: 'esnext',
        outDir: './dist/esm',
        declarationDir: './dist/esm',
      }),
      terser(),
    ],
  },
  {
    ...getSharedConfig('cjs', 'dist/cjs/bundle.cjs.js'),
    plugins: [
      {
        name: 'replace-node-events',
        resolveId(source) {
          if (source === 'node:events') {
            return 'events';
          }
          return null;
        },
      },
      nodePolyfills({
        include: ['events'],
      }),
      generatePackageJson({
        baseContents: (pkg) => ({
          name: pkg.name,
          version: pkg.version,
          type: 'commonjs',
        }),
      }),
      typescript({
        outDir: './dist/cjs',
        declarationDir: './dist/cjs',
      }),
      common(),
      resolve(),
      terser(),
    ],
  },
];
