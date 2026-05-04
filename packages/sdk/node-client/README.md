# LaunchDarkly Client-Side SDK for Node.js

[![NPM][node-client-sdk-npm-badge]][node-client-sdk-npm-link]
[![Actions Status][node-client-sdk-ci-badge]][node-client-sdk-ci]

The LaunchDarkly Client-Side SDK for Node.js is designed for use in desktop and console applications running in a Node.js environment, where one or more end users are represented as LaunchDarkly contexts.

This SDK uses the LaunchDarkly client-side feature evaluation logic. For server-to-server use cases on Node.js (one process serving many users), use the [`@launchdarkly/node-server-sdk`][node-server-sdk] package instead.

## Install

```bash
npm install --save @launchdarkly/node-client-sdk
```

## Quickstart

See the full [Node.js (client-side) SDK reference](https://launchdarkly.com/docs/sdk/client-side/node-js) for in-depth instructions.

```js
import { createClient } from '@launchdarkly/node-client-sdk';

const client = createClient('YOUR_CLIENT_SIDE_ID', {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
});

await client.start();
const flagValue = await client.variation('your-flag-key', false);
console.log(`Flag value: ${flagValue}`);
```

## Migrating from `launchdarkly-node-client-sdk`

`@launchdarkly/node-client-sdk` is the successor to [`launchdarkly-node-client-sdk`](https://github.com/launchdarkly/node-client-sdk). The two packages are similar but the new one is built on the modern `@launchdarkly/js-client-sdk-common` core and supports newer LaunchDarkly capabilities. See the migration guide in our public docs for details on breaking changes.

The standalone `launchdarkly-node-client-sdk` package will receive critical fixes only. New features land here.

## Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) at the repository root.

[node-client-sdk-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/node-client-sdk.svg?style=flat-square
[node-client-sdk-npm-link]: https://www.npmjs.com/package/@launchdarkly/node-client-sdk
[node-client-sdk-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/node-client.yml/badge.svg
[node-client-sdk-ci]: https://github.com/launchdarkly/js-core/actions/workflows/node-client.yml
[node-server-sdk]: https://www.npmjs.com/package/@launchdarkly/node-server-sdk
