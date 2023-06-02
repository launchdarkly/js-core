# LaunchDarkly Vercel Edge SDK examples

The following examples showcase using the LaunchDarkly Vercel Edge SDK to evaluate feature flags in Vercel's [Edge Runtime](https://vercel.com/docs/concepts/functions/edge-functions/edge-runtime). Both examples require the use of the [LaunchDarkly Vercel integration](https://docs.launchdarkly.com/integrations/vercel) to push feature flag data into Vercel's Edge Config.

## [Complete example](complete/README.md)

This example shows how to evaluate feature flags in Vercel's edge runtime using the [LaunchDarkly Vercel SDK](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/vercel). Two primary use cases are highlighted:

1. Bootstrapping feature flags from the edge runtime and consuming them in the [LaunchDarkly Client-side SDK for React](https://github.com/launchdarkly/react-client-sdk). This is leveraging feature flags in edge-rendered pages while still maintaining the events and ergonomics provided by the React SDK. You can see details in [`app/layout.tsx`](./app/layout.tsx) and [`components/launchdarklyProvider.tsx`](./components/launchdarklyProvider.tsx).
2. Evaluating feature flags in the [Edge Middleware](https://vercel.com/docs/concepts/functions/edge-middleware). This can be seen in [`middleware.ts`](./middleware.ts).

### Demo

https://hello-vercel-edge.vercel.app/

## [Route Handler example](route-handler/README.md)

This is an example test app to showcase the usage of the Vercel LaunchDarkly
SDK to evaluate a feature flag in a [Route Handler](https://nextjs.org/docs/app/building-your-application/routing/router-handlers) using [Vercel's edge runtime](https://nextjs.org/docs/app/building-your-application/routing/router-handlers#edge-and-nodejs-runtimes).
