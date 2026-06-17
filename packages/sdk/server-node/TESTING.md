# Using this build of `@launchdarkly/node-server-sdk` in your app

This guide explains how to consume this local fork/build of the Node server SDK in a
separate test application — for example, to try out the SOCKS proxy support on the
`socks-proxy-support` branch before it is published to npm.

The package is `@launchdarkly/node-server-sdk` (currently version `9.11.2`). It lives in
a monorepo, so you must build it (and its workspace dependencies) before consuming it.

## 1. Build the SDK

From the **root** of the monorepo, build this package and everything it depends on.
Running `yarn build` inside the package directory alone will **not** rebuild its
dependencies.

```bash
yarn                 # install workspace deps (first time only)
yarn workspaces foreach -pR --topological-dev \
  --from '@launchdarkly/node-server-sdk' run build
```

This produces the compiled output in `packages/sdk/server-node/dist`.

## 2a. Install via tarball (recommended)

The tarball method most closely mirrors a real `npm install` from the registry. It
bundles only the files that would actually be published, and it avoids the symlink
pitfalls of a monorepo (see the note at the end).

From `packages/sdk/server-node`:

```bash
yarn pack            # creates package.tgz in this directory
```

Then, in your **test app**, install the tarball by absolute or relative path:

```bash
npm install /path/to/js-core/packages/sdk/server-node/package.tgz
# or with yarn:
yarn add /path/to/js-core/packages/sdk/server-node/package.tgz
```

Re-run `yarn pack` and re-install after every change you want to test.

> Tip: `yarn pack --filename ld-node-sdk.tgz` lets you give the archive a stable name
> so your test app's `package.json` reference doesn't change between builds.

## 2b. Install via `file:` reference (fast iteration)

For rapid local iteration, point your test app's `package.json` directly at the built
package directory:

```jsonc
{
  "dependencies": {
    "@launchdarkly/node-server-sdk": "file:/path/to/js-core/packages/sdk/server-node"
  }
}
```

Then `npm install` / `yarn install` in the test app. With this approach you only need to
re-run the **build** (step 1) after a change — no re-pack, no re-install.

> Caveat: because this is a monorepo, the package's own dependencies
> (`@launchdarkly/js-server-sdk-common`, etc.) are symlinked under the workspace root,
> not inside `packages/sdk/server-node/node_modules`. A `file:` install copies/links the
> package but may not resolve those workspace deps the way the registry would. If you hit
> "module not found" errors for `@launchdarkly/*` packages, use the tarball method in 2a
> instead, which inlines the correct dependency versions.

## 3. Use the SDK in your app

Standard usage is unchanged from the published SDK:

```js
const { init } = require('@launchdarkly/node-server-sdk');

const client = init('your-sdk-key');

await client.waitForInitialization({ timeout: 10 });
const value = await client.variation('your-flag-key', { key: 'user-123' }, false);
console.log(value);
```

## 4. Testing the SOCKS proxy support

This branch adds SOCKS proxy support via the existing `proxyOptions` config. Set
`scheme` to a SOCKS scheme; `host` and `port` identify the SOCKS proxy, and `auth`
(if needed) carries the `username:password` credentials.

Supported schemes: `socks`, `socks4`, `socks4a`, `socks5`, `socks5h`
(plus the existing `http` / `https` HTTP-proxy schemes).

```js
const { init } = require('@launchdarkly/node-server-sdk');

const client = init('your-sdk-key', {
  proxyOptions: {
    scheme: 'socks5',
    host: '127.0.0.1',
    port: 1080,
    // Optional. The password may contain ':' — only the first ':' splits user/password.
    auth: 'proxyuser:proxypassword',
  },
});

await client.waitForInitialization({ timeout: 10 });
console.log(await client.variation('your-flag-key', { key: 'user-123' }, false));
```

A single SOCKS agent handles both the streaming (HTTPS) and event-delivery connections,
so no separate configuration is required for each.

If you just want to confirm the proxy path works without a real SDK key, the repo's own
test harness spins up an in-process SOCKS server — see
[`__tests__/socksProxyServer.ts`](__tests__/socksProxyServer.ts) and
[`__tests__/LDClientNode.socksProxy.test.ts`](__tests__/LDClientNode.socksProxy.test.ts).
Run them with:

```bash
yarn workspace @launchdarkly/node-server-sdk test
```
