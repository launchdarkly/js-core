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

This demo requires Node.js 20 or higher, and a running SOCKS proxy.

## Run instructions

This example uses the workspace build of `@launchdarkly/node-server-sdk`. From the repository
root, build the SDK and its dependencies first:

```bash
yarn workspaces foreach -pR --topological-dev --from '@launchdarkly/node-server-sdk' run build
```

You need a SOCKS5 proxy to route traffic through. `SOCKS_PROXY_URL` is **required** - the example
exits with an error if it is unset. This directory's `proxy/` folder builds and runs
[Dante](https://www.inet.no/dante/), a real SOCKS5 server, in Docker:

```bash
docker build -t ld-example-socks-proxy packages/sdk/server-node/examples/features/custom-socks-proxy/proxy
docker run --rm -d --name ld-example-socks-proxy -p 1080:1080 ld-example-socks-proxy
export SOCKS_PROXY_URL="socks5h://127.0.0.1:1080"
```

If you already have an SSH server reachable (for example your own machine with Remote Login /
sshd enabled), a dynamic port forward works just as well and needs no Docker:

```bash
ssh -D 1080 -N user@your-server &
export SOCKS_PROXY_URL="socks5h://127.0.0.1:1080"
```

`SOCKS_PROXY_URL` accepts any URL `SocksProxyAgent` understands, including embedded credentials
(`socks5://user:password@host:port`) if your proxy requires authentication.

Then set your LaunchDarkly server-side SDK key and start the example:

```bash
export LAUNCHDARKLY_SDK_KEY="my-sdk-key"
export LAUNCHDARKLY_FLAG_KEY="my-boolean-flag" # optional; defaults to "sample-feature"

yarn start
```

When you're done, stop the proxy container (only needed if you used the Docker option above):

```bash
docker stop ld-example-socks-proxy
```

## What it demonstrates

- Constructing a `SocksProxyAgent` and passing it as `proxyAgent` in `LDOptions`.
- The SDK using that agent for both polling and streaming connections, with no additional
  proxy-specific configuration.

The application evaluates one flag and exits. Toggle `LAUNCHDARKLY_FLAG_KEY` in your LaunchDarkly
project to see a different value.
