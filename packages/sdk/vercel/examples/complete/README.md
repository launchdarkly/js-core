# LaunchDarkly sample Vercel application

This example shows how to evaluate feature flags in Vercel's edge runtime using the
[LaunchDarkly Vercel SDK](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/vercel).
Two primary use cases are highlighted:

1. **Edge Middleware** ([`proxy.ts`](./proxy.ts)) — evaluates a feature flag per request
   and attaches the result as a header for server-rendering.
2. **Edge Route Handler** ([`app/api/flag/route.ts`](./app/api/flag/route.ts)) — evaluates a
   feature flag and returns JSON, used by the client to poll for live updates.

Both share a single edge client defined in [`lib/ldEdgeClient.ts`](./lib/ldEdgeClient.ts).

## Local development

#### Create a new LaunchDarkly project and flag

For simplicity, we recommend
[creating a new LaunchDarkly project](https://docs.launchdarkly.com/home/organize/projects/?q=create+proj)
for this example app. After creating a new project, create a single boolean feature flag with
client-side SDK availability:

- `sample-feature` — (Boolean) the flag this example evaluates and renders.

#### Set up the LaunchDarkly Vercel integration

You will need to have the LaunchDarkly Vercel integration configured to push feature flag data to
your Vercel Edge Config. Read the
[Vercel documentation](https://docs.launchdarkly.com/integrations/vercel/) to set up the
integration. Be sure to connect the project you created above.

#### Set up environment variables

1. Copy this directory into a new repository.
2. Create a new Vercel project based on the new repository.
3. [Add a new environment variable to your project](https://vercel.com/docs/concepts/projects/environment-variables)
   named `LD_CLIENT_SIDE_ID` and set it to the LaunchDarkly client-side ID for the **Test**
   environment in the project you created above.
4. Follow [Vercel's documentation](https://vercel.com/docs/storage/edge-config/get-started) to
   connect an Edge Config to your new project.
5. Run the following command to link your local codebase to your Vercel project:

   ```shell
   vercel link
   ```

6. Run the following command to sync your project's environment variables in your development
   environment:

   ```shell
   vercel env pull .env.development.local
   ```

7. After completing the steps above, you should have linked this example app to your Vercel
   project and created a `.env.development.local`.
8. Verify the contents of `.env.development.local` have values for `LD_CLIENT_SIDE_ID` and
   `EDGE_CONFIG`.
9. Run the following command to install all dependencies:

   ```shell
   yarn
   ```

10. Run the following command to start your development environment:

    ```shell
    yarn dev
    ```

Open [http://localhost:3000](http://localhost:3000). You should see:

- **Green background** (`#00844B`) when the flag evaluates to `true`
- **Dark background** (`#373841`) when the flag evaluates to `false`
- The message: "The sample-feature feature flag evaluates to true/false."

The page polls `/api/flag` every 2 seconds. Toggle the flag in LaunchDarkly and the background
color will update automatically.

## How it works

| Path | Purpose |
|------|---------|
| [`proxy.ts`](./proxy.ts) | Edge Middleware that evaluates the flag and sets a header for server-rendering. |
| [`app/api/flag/route.ts`](./app/api/flag/route.ts) | Edge Route Handler that evaluates the flag and returns JSON for client polling. |
| [`app/page.tsx`](./app/page.tsx) | Server component that reads the middleware header for the initial render. |
| [`app/FlagDisplay.tsx`](./app/FlagDisplay.tsx) | Client component that polls `/api/flag` every 2 seconds for live updates. |
| [`lib/ldEdgeClient.ts`](./lib/ldEdgeClient.ts) | Lazily-initialized LaunchDarkly Vercel SDK client shared by middleware and route handler. |
