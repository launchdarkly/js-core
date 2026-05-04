# hello-node-client

A minimal example application that uses the LaunchDarkly Client-Side SDK for Node.js.

## Build and run

From the repository root:

```bash
yarn install
yarn workspace @launchdarkly/node-client-sdk build
LAUNCHDARKLY_CLIENT_SIDE_ID=<your-client-side-id> \
  yarn workspace hello-node-client start
```

By default the example evaluates a flag named `sample-feature`. Override it with `LAUNCHDARKLY_FLAG_KEY=<flag-key>`.
