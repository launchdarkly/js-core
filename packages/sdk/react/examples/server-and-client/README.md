# Server and client example (Next.js App Router)

This example shows LaunchDarkly with both **server** and **client** boundaries in a single Next.js app. It uses a **single** `LDIsomorphicClient` for both: one creation in `app/lib/ld-client.ts`, federated with the server client in `app/lib/ld-server.ts`, so the same API works in Server Components and Client Components.

## Import boundaries

To keep bundles correct and avoid server code in the client (and vice versa):

- **Shared:** Import `ldIsomorphicClient` from `app/lib/ld-client` in Client Components. The `ld-client` module does not import any server-only code.
- **SERVER ONLY:** Import from `app/lib/ld-server` in Server Components (or server-only modules). Do not import `ld-server` in any `'use client'` file. The `ld-server` module imports `@launchdarkly/react-sdk/server` and `@launchdarkly/node-server-sdk` and federates the shared client with `useServerClient()`.

The page shows "Server: sample-feature is on/off" (from RSC) and "Client: sample-feature is on/off" (from the client component) so both boundaries are visible.

## Running

Set `LAUNCHDARKLY_SDK_KEY` and `NEXT_PUBLIC_LD_CLIENT_SIDE_ID` (or `LD_CLIENT_SIDE_ID`), then:

```sh
yarn install
yarn build
yarn start
```

Or `yarn dev` for development.
