import { defineConfig } from 'tsup';

const sharedOptions = {
  minify: true,
  format: ['esm', 'cjs'],
  splitting: false,
  sourcemap: false,
  noExternal: [
    '@launchdarkly/js-sdk-common',
    '@launchdarkly/js-client-sdk-common',
    '@launchdarkly/js-client-sdk',
    '@launchdarkly/js-server-sdk',
  ],
  dts: true,
  metafile: true,
};

const mangleProps = (opts) => {
  // This would normally be `^_(?!meta|_)`, but go doesn't support negative look-ahead assertions,
  // so we need to craft something that works without it.
  // So start of line followed by a character that isn't followed by m or underscore, but we
  // want other things that do start with m, so we need to progressively handle more characters
  // of meta with exclusions.
  opts.mangleProps = /^_([^m|_]|m[^e]|me[^t]|met[^a])/;
};

export default defineConfig([
  {
    ...sharedOptions,
    entry: { index: 'src/client/index.ts' },
    clean: true,
    esbuildOptions(opts) {
      opts.banner = { js: '"use client";' };
      mangleProps(opts);
    },
  },
  {
    ...sharedOptions,
    entry: { server: 'src/server/index.ts' },
    clean: false,
    external: ['@launchdarkly/react-sdk'],
    esbuildOptions(opts) {
      mangleProps(opts);
    },
  },
]);
