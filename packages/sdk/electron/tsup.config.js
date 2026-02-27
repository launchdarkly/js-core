import { defineConfig } from 'tsup';

export default defineConfig([
{
  entry: {
    index: 'src/index.ts',
    renderer: 'src/renderer/index.ts',
    bridge: 'src/bridge/index.ts',
  },
  minify: true,
  format: ['esm', 'cjs'],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  metafile: true,
  esbuildOptions(opts) {
    // Equivalent to `^_(?!meta|_)`, but esbuild's regex engine (Go's RE2) has no negative
    // lookahead. This excludes each prefix of "meta" one character at a time instead.
    opts.mangleProps = /^_([^m|_]|m[^e]|me[^t]|met[^a])/;
  },
}]);
