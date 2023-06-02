# LaunchDarkly Feature Flag Apple Store

This example shows how to evaluate feature flags in Vercel's edge runtime using the [LaunchDarkly Vercel SDK](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/vercel). Two primary use cases are highlighted:

1. Bootstrapping feature flags from the edge runtime and consuming them in the [LaunchDarkly Client-side SDK for React](https://github.com/launchdarkly/react-client-sdk). This is leveraging feature flags in edge-rendered pages while still maintaining the events and ergonomics provided by the React SDK. You can see details in [`app/layout.tsx`](./app/layout.tsx) and [`components/launchdarklyProvider.tsx`](./components/launchdarklyProvider.tsx).
2. Evaluating feature flags in the [Edge Middleware](https://vercel.com/docs/concepts/functions/edge-middleware). This can be seen in [`middleware.ts`](./middleware.ts).

## Demo

https://hello-vercel-edge.vercel.app/

## How to Use

#### Create a new LaunchDarkly project and flags

For simplicity, we recommend [creating a new LaunchDarkly project](https://docs.launchdarkly.com/home/organize/projects/?q=create+proj) for this example app. After creating a new project, create the following feature flags with Client-side SDK availability:

- `bootstrap-flags` - (Boolean) - This flag will determine whether or not the LaunchDarkly React SDK will bootstrap feature flags from the edge.
- `show-debugging-info` - (Boolean) - This flag is used to expose the current flag values.
- `hero-text` - (String) - This flag is used to dynamically change the hero text. You can make the variations anything you want, e.g. "The best way to buy the products you love."
- `enable-hot-dog-favicon` - (Boolean) - This flag is used in middleware.ts to dynamically load a different favicon.
- `store-closed` - (Boolean) - This flag is evaluated in `middleware.ts` and can be used to load a different home page when the store is closed.

#### Set up the LaunchDarkly Vercel integration

You will need to have the LaunchDarkly Vercel integration configured to push feature flag data to your Vercel Edge Config. Read [Vercel](https://docs.launchdarkly.com/integrations/vercel/) to set up the integration. Be sure to connect the project you created above.

#### Set up environment variables

Copy the `.env.example` file in this directory to `.env.local` (which will be ignored by Git):

```bash
cp .env.example .env.local
```

Set `LD_CLIENT_SIDE_ID` to the LaunchDarkly client-side ID from the same environment you used when configuring the LaunchDarkly + Vercel integration.

This example requires you to set up an Edge Config and store its connection string in the `EDGE_CONFIG` environment variable. You can specify the Edge Config connection string in `.env.local`, but it's probably easier to run the following command after linking the Edge Config to a project in vercel:

```bash
vercel env pull .env.development.local
```

#### Run the app locally

Next, run Next.js in development mode:

```bash
npm run dev
```

Deploy it to the cloud with [Vercel](https://vercel.com/new?utm_source=github&utm_medium=readme&utm_campaign=edge-middleware-eap) ([Documentation](https://nextjs.org/docs/deployment)).
