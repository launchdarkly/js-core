import { defineConfig } from 'tsup';
import { prependDirective } from 'tsup-plugin-prepend-directive';

export default defineConfig([
{
  entry: {
    // We may need to split this one up so we can perserve the
    // client and server directives.
    index: 'src/index.ts',
    client: 'src/client/index.ts',
    server: 'src/server/index.ts',
  },
  minify: true,
  format: ['esm', 'cjs'],
  splitting: false,
  sourcemap: true,
  clean: true,
  noExternal: [
    '@launchdarkly/js-sdk-common',
    '@launchdarkly/js-client-sdk-common',
    '@launchdarkly/js-client-sdk',
    '@launchdarkly/js-server-sdk'
  ],
  dts: true,
  metafile: true,
  esbuildOptions(opts) {
    // This would normally be `^_(?!meta|_)`, but go doesn't support negative look-ahead assertions,
    // so we need to craft something that works without it.
    // So start of line followed by a character that isn't followed by m or underscore, but we
    // want other things that do start with m, so we need to progressively handle more characters
    // of meta with exclusions.
    // eslint-disable-next-line no-param-reassign
    opts.mangleProps = /^_([^m|_]|m[^e]|me[^t]|met[^a])/;
  },
  plugins: [
    prependDirective('"use server"', ['dist/server.js', 'dist/server.cjs']),
  ],
}]);
