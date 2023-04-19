# Example test app for Cloudflare LaunchDarkly SDK

This is an example test app to showcase the usage of the Cloudflare LaunchDarkly
SDK. This app was created with wrangler v2.

## Installation and usage

1. Insert test data to the preview environment:

```shell
# The Cloudflare SDK automatically adds the "LD-Env-" prefix to your sdk key
npx wrangler kv:key put --binding=LD_KV "LD-Env-test-sdk-key" --path ./src/testData.json --preview
```

2. View that test data to ensure it's present:

```shell
npx wrangler kv:key get --binding=LD_KV "LD-Env-test-sdk-key" --preview
```

3. Install packages and run the app:

```shell
yarn && yarn start
```
