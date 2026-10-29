# Package configuration tests

These tests check the published form of every released package (the tarball from
`yarn pack`), installed with Yarn into fresh consumer projects, against many build
configurations. The consumer projects use the repository's `npmMinimalAgeGate` and
`npmPreapprovedPackages` from `.yarnrc.yml` (added to the template in
`fixtures/consumer.yarnrc.yml`), so external dependencies, including transitive
ones, only install once they are old enough. Workspace links and source files are never used, so the tests see exactly what
users install.

| Suite             | What it checks                                                                                                                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types:<version>` | `tsc` with `strict` and `skipLibCheck: false` importing every entrypoint, for `node10`, `node16` and `nodenext` (CommonJS and ES module consumers), `bundler` and `preserve`. TypeScript 5.0.4, 5.9.3 and 6.0.3.                         |
| `attw`            | [Are the types wrong?](https://github.com/arethetypeswrong/arethetypeswrong.github.io) for every entrypoint and resolution mode.                                                                                                         |
| `runtime`         | Node `require` and `import` of every entrypoint, and esbuild bundles for `node` (ESM and CJS), `browser` and `neutral`.                                                                                                                  |
| `cloudflare`      | Workers run in workerd with `wrangler dev` and local KV: a TypeScript Worker, the OpenFeature provider, a Worker using `require`, and a Worker prebuilt with tsup. Each one must evaluate a flag. Also runs `wrangler deploy --dry-run`. |
| `vercel`          | A Next.js app with an edge route handler and edge middleware, built with Turbopack and webpack and served with `next start`. The real `@vercel/edge-config` client reads flag data from a local mock of the Edge Config API.             |

## Caveats

Some cases step outside the standard matrix to cover a regression it cannot see:

- The `tls` cases in the `types` suite (`<package> | tls | ts<version>`) assign
  `tlsParams: { ca: fs.readFileSync(...) }` to the server `LDOptions`, with @types/node pinned
  to 22.13.6 instead of the matrix version. On a band of @types/node releases, inferring the
  global `Buffer` type from the wrong declaration resolves it to `Buffer<ArrayBuffer>`, which
  rejects the `fs.readFileSync` result under TypeScript 5.9 and later. The matrix cannot catch
  this: its @types/node version is outside the band, and importing an entrypoint never assigns
  a value. These cases run for TypeScript 5.9.3 and 6.0.3 and use `skipLibCheck: true`, so they
  check the published option types and not the @types/node internals. A second assignment
  (`ca: 42`) must be rejected, which shows the type did not collapse to `any`.

## Baselines

Results are compared with `baseline/<suite>.json`. Each case is `ok` or a short description of
the failure (TypeScript error codes, ATTW problem kinds, or `fail`). Known limitations, such as
packages without `node10` subpath support or ESM-only packages under `node16` CommonJS, are
recorded there.

Any difference from the baseline fails the run. A case that was `ok` and now fails is reported
as a regression. If a change is intended, for example a fix that turns a failure into `ok`,
update the baseline and commit it with the change.

## Running locally

```bash
yarn && yarn build
node scripts/package-config-tests/run.js pack
node scripts/package-config-tests/run.js types:5.9.3
node scripts/package-config-tests/run.js runtime
# To accept new results:
node scripts/package-config-tests/run.js types:5.9.3 --update
```

`--work <dir>` sets the directory used for consumer projects (default: a directory in the OS
temp directory) and `--packs <dir>` the directory with the tarballs (default: `<work>/packs`).
After each run, `<work>/<suite>-details.json` contains the error output of each failing case.
