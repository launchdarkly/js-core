# Example test app for Vercel LaunchDarkly SDK

This is an example test app to showcase the usage of the Vercel LaunchDarkly
SDK. This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Prerequisites

A node environment of version 16 and yarn are required to develop in this repository.
You will also need the vercel cli installed and a Vercel account to setup
the test data required by this example. See the [Vercel docs](https://vercel.com/docs/storage/edge-config/get-started) on how to setup your edge config store.

## Usage

1. Follow the [Vercel docs](https://vercel.com/docs/storage/edge-config/get-started) to insert [testData.json](https://github.com/launchdarkly/js-core/blob/main/packages/sdk/vercel/testData.json) to your edge config store.

2. After completing the guide above, you should have linked this example app to your Vercel project and created an `.env.development.local`.

3. At the root of the js-core repo:

```shell
yarn && yarn build
```

4. Then back in this example folder:

```shell
yarn dev
```

5. Open [http://localhost:3000/api/hello](http://localhost:3000/api/hello) in your browser.
