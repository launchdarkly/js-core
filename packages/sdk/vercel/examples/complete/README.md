# Complete example app for Vercel LaunchDarkly SDK

This example shows how to evaluate feature flags in Vercel's edge runtime using the [LaunchDarkly Vercel SDK](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/vercel). Two primary use cases are highlighted:

1. Bootstrapping feature flags from the edge runtime and consuming them in the [LaunchDarkly Client-side SDK for React](https://github.com/launchdarkly/react-client-sdk). This is leveraging feature flags in edge-rendered pages while still maintaining the events and ergonomics provided by the React SDK. You can see details in [`app/layout.tsx`](./app/layout.tsx) and [`components/launchdarklyProvider.tsx`](./components/launchdarklyProvider.tsx).
2. Evaluating feature flags in the [Edge Middleware](https://vercel.com/docs/concepts/functions/edge-middleware). This can be seen in [`middleware.ts`](./middleware.ts).

## Demo

https://hello-vercel-edge.vercel.app/

## Local development

#### Create a new LaunchDarkly project and flags

For simplicity, we recommend [creating a new LaunchDarkly project](https://docs.launchdarkly.com/home/organize/projects/?q=create+proj) for this example app. After creating a new project, create the following feature flags with Client-side SDK availability:

- `bootstrap-flags` - (Boolean) - This flag will determine whether or not the LaunchDarkly React SDK will bootstrap feature flags from the edge.
- `show-debugging-info` - (Boolean) - This flag is used to expose the current flag values.
- `hero-text` - (String) - This flag is used to dynamically change the hero text. You can make the variations anything you want, e.g. "The best way to buy the products you love."
- `enable-hot-dog-favicon` - (Boolean) - This flag is used in middleware.ts to dynamically load a different favicon.
- `store-closed` - (Boolean) - This flag is evaluated in `middleware.ts` and can be used to load a different home page when the store is closed.

#### Set up the LaunchDarkly Vercel integration

You will need to have the LaunchDarkly Vercel integration configured to push feature flag data to your Vercel Edge Config. Read the [Vercel documentation](https://docs.launchdarkly.com/integrations/vercel/) to set up the integration. Be sure to connect the project you created above.

#### Set up environment variables

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
