# Example test app for Vercel LaunchDarkly SDK

This is an example test app to showcase the usage of the Vercel LaunchDarkly
SDK to evaluate a feature flag in a [Route Handler](https://nextjs.org/docs/app/building-your-application/routing/router-handlers) using [Vercel's edge runtime](https://nextjs.org/docs/app/building-your-application/routing/router-handlers#edge-and-nodejs-runtimes). This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

Most of the LaunchDarkly-related code can be found in [src/app/api/hello/route.ts](src/app/api/hello/route.ts).

## Prerequisites

A node environment of version 16 and yarn are required to develop in this repository.
You will also need the [Vercel CLI](https://vercel.com/docs/cli) installed and a Vercel account to setup
the test data required by this example. See the [Vercel docs](https://vercel.com/docs/storage/edge-config/get-started) on how to setup your Edge Config store.

## Setting up your LaunchDarkly environment

For simplicity, we recommend [creating a new LaunchDarkly project](https://docs.launchdarkly.com/home/organize/projects/?q=create+proj) for this example app. After creating a new project, create the following feature flags with Client-side SDK availability:

- `test-flag` - (Boolean) - This flag is evaluated in [src/app/api/hello/route.ts](src/app/api/hello/route.ts).

After creating your project, You will need to have the LaunchDarkly Vercel integration configured to push feature flag data to your Vercel Edge Config. Read [Vercel](https://docs.launchdarkly.com/integrations/vercel/) to set up the integration. Be sure to connect the **Test** environment for project you created above.

## Setting up your development environment

1. Copy this directory in a new repository.
2. Create a new Vercel project based on the new repository.
3. [Add a new environment variable to your project](https://vercel.com/docs/concepts/projects/environment-variables) named `LD_CLIENT_SIDE_ID` and set it to the LaunchDarkly client-side ID for the **Test** environment in the project you created above.
4. Follow [Vercel's documentation](https://vercel.com/docs/storage/edge-config/get-started) to connect an Edge Config to your new project.
5. Run the following command to link your local codebase to your Vercel project:

```shell
vercel link
```

6. Run the following command to sync your projects environment variables in your development environment:

```shell
vercel env pull .env.development.local
```

7. After completing the guide above, you should have linked this example app to your Vercel project and created an `.env.development.local`.
8. Verify the contents of `.env.development.local` have values for the `LD_CLIENT_SIDE_ID` and `EDGE_CONFIG`.
9. Run the following command to install all dependencies:

```shell
yarn
```

10. Run the following command to start your development environment:

```shell
yarn dev
```

11. Open [http://localhost:3000/api/hello](http://localhost:3000/api/hello).
