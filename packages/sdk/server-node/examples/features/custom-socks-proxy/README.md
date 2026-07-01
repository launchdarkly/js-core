# LaunchDarkly Node.js server-side SDK: custom SOCKS proxy example

This example demonstrates the `proxyAgent` option on `LDOptions`, a Node-specific escape hatch
that lets an application route all of the SDK's outbound traffic (polling and streaming) through
an `http.Agent`/`https.Agent` of its own choosing. The SDK does not build SOCKS support itself;
instead, the application constructs a [`SocksProxyAgent`](https://www.npmjs.com/package/socks-proxy-agent)
and hands it to the SDK via `proxyAgent`.

```ts
import { SocksProxyAgent } from 'socks-proxy-agent';
import { init } from '@launchdarkly/node-server-sdk';

const client = init(sdkKey, {
  proxyAgent: new SocksProxyAgent('socks5h://127.0.0.1:1080'),
});
```

This demo requires Node.js 20 or higher.

## Run instructions

This example uses the workspace build of `@launchdarkly/node-server-sdk`. From the repository
root, build the SDK and its dependencies first:

```bash
yarn workspaces foreach -pR --topological-dev --from '@launchdarkly/node-server-sdk' run build
```

Then set your LaunchDarkly server-side SDK key and start the example:

```bash
export LAUNCHDARKLY_SDK_KEY="my-sdk-key"
export LAUNCHDARKLY_FLAG_KEY="my-boolean-flag" # optional; defaults to "sample-feature"

yarn start
```

### Using your own SOCKS proxy

By default this example spins up a small in-process SOCKS5 proxy (see
[`src/localSocksProxyServer.ts`](./src/localSocksProxyServer.ts)) so it runs without any external
setup. To exercise a real SOCKS proxy instead, set `SOCKS_PROXY_URL` to point at it before
running `yarn start`:

```bash
# For example, an SSH dynamic port forward:
ssh -D 1080 -N user@your-server &

export SOCKS_PROXY_URL="socks5h://127.0.0.1:1080"
yarn start
```

`SOCKS_PROXY_URL` accepts any URL `SocksProxyAgent` understands, including embedded credentials
(`socks5://user:password@host:port`).

## What it demonstrates

- Constructing a `SocksProxyAgent` and passing it as `proxyAgent` in `LDOptions`.
- The SDK using that agent for both polling and streaming connections, with no additional
  proxy-specific configuration.
- Confirmation that traffic actually flowed through the proxy: when using the bundled demo proxy,
  the example logs how many connections it relayed on the SDK's behalf.

The application evaluates one flag and exits. Toggle `LAUNCHDARKLY_FLAG_KEY` in your LaunchDarkly
project to see a different value.
