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
  tsconfig: 'tsconfig.build.json',
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

// Do not set `clean` in any config. The configs run at the same time. A config with `clean: true`
// deletes all declaration files in `dist` when its declaration build starts. This removes the
// declaration files of the other configs. The build script runs `rm -rf dist` before tsup.
export default defineConfig([
  {
    ...sharedOptions,
    entry: { index: 'src/client/index.ts' },
    esbuildOptions(opts) {
      opts.banner = { js: '"use client";' };
      mangleProps(opts);
    },
  },
  {
    ...sharedOptions,
    entry: { server: 'src/server/index.ts' },
    external: ['@launchdarkly/react-sdk'],
    esbuildOptions(opts) {
      mangleProps(opts);
    },
  },
  {
    ...sharedOptions,
    entry: { 'fetch-eventsource': 'src/fetch-eventsource/index.ts' },
    // Keep the browser SDK's entry as an import so `@launchdarkly/eventsource` stays an optional
    // dependency of js-client-sdk and is not bundled or required from this package.
    // __tests__/fetch-eventsource/externalization.test.ts fails if the entry gets bundled.
    noExternal: sharedOptions.noExternal.filter((name) => name !== '@launchdarkly/js-client-sdk'),
    external: ['@launchdarkly/js-client-sdk'],
    esbuildOptions(opts) {
      mangleProps(opts);
    },
  },
]);
