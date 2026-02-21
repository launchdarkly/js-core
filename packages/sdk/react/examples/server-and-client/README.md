# Server and client example (Next.js App Router)

This example shows LaunchDarkly with both **server** and **client** boundaries in a single Next.js app.

## Import boundaries

To keep bundles correct and avoid server code in the client (and vice versa):

- **SERVER ONLY:** Import `@launchdarkly/react-sdk/server` and `@launchdarkly/node-server-sdk` only in Server Components or server-only modules (e.g. `app/lib/ld-server.ts`). Do not import these in any `'use client'` file.
- **CLIENT ONLY:** Import `@launchdarkly/react-sdk` or `@launchdarkly/react-sdk/client` in Client Components. Do not import the server entry or node-server-sdk in client code.

The page shows "Server: sample-feature is on/off" (from RSC) and "Client: sample-feature is on/off" (from the client component) so both boundaries are visible.

## Running

Set `LAUNCHDARKLY_SDK_KEY` and `NEXT_PUBLIC_LD_CLIENT_SIDE_ID` (or `LD_CLIENT_SIDE_ID`), then:

```sh
yarn install
yarn build
yarn start
```

Or `yarn dev` for development.
