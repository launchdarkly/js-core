# Example test app for Cloudflare LaunchDarkly SDK

This is an example test app to showcase the usage of the Cloudflare LaunchDarkly
SDK. This app was created with wrangler v2.

## Prerequisites

A node environment of version 16 and yarn are required to develop in this repository.
You will also need the wrangler cli installed and a Cloudflare account to setup
the test data required by this example. See the [wrangler docs](https://developers.cloudflare.com/workers/wrangler/commands/#login)
on how to login to your Cloudflare account. Make sure you are logged in before
attempting to follow the usage instructions below.

## Usage

1. At the root of the js-core repo:

```shell
yarn && yarn build
```

2. Then back in this example, replace `YOUR_KV_ID` and `YOUR_PREVIEW_KV_ID` in [wrangler.toml](https://github.com/launchdarkly/js-core/blob/main/packages/sdk/cloudflare/example/wrangler.toml) with your account values:

```toml
kv_namespaces = [{ binding = "LD_KV", id = "YOUR_KV_ID", preview_id = "YOUR_PREVIEW_KV_ID" }]
```

3. Insert test data to the preview environment:

```shell
# The Cloudflare SDK automatically adds the "LD-Env-" prefix to your sdk key
npx wrangler kv:key put --binding=LD_KV "LD-Env-test-sdk-key" --path ./src/testData.json --preview
```

4. View that test data to ensure it's present:

```shell
npx wrangler kv:key get --binding=LD_KV "LD-Env-test-sdk-key" --preview
```

5. Finally:

```shell
yarn start
```
