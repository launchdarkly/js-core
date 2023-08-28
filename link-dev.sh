#!/bin/bash

echo "===== Linking to cloudflare/example"

rm -rf packages/sdk/cloudflare/example/node_modules/@launchdarkly/js-sdk-common/dist
cp -r packages/shared/common/dist packages/sdk/cloudflare/example/node_modules/@launchdarkly/js-sdk-common/dist

rm -rf packages/sdk/cloudflare/example/node_modules/@launchdarkly/js-server-sdk-common/dist
cp -r packages/shared/sdk-server/dist packages/sdk/cloudflare/example/node_modules/@launchdarkly/js-server-sdk-common/dist

rm -rf packages/sdk/cloudflare/example/node_modules/@launchdarkly/js-server-sdk-common-edge/dist
cp -r packages/shared/sdk-server-edge/dist packages/sdk/cloudflare/example/node_modules/@launchdarkly/js-server-sdk-common-edge/dist

rm -rf packages/sdk/cloudflare/example/node_modules/@launchdarkly/cloudflare-server-sdk/dist
cp -r packages/sdk/cloudflare/dist packages/sdk/cloudflare/example/node_modules/@launchdarkly/cloudflare-server-sdk/dist
