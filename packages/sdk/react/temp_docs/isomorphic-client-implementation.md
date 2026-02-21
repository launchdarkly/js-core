# Isomorphic client implementation and tree-shaking

> **Status:** Experimental. This document describes how the isomorphic client is implemented and how bundle size is kept minimal for client-only usage.

## Overview

The LaunchDarkly React SDK exposes an **isomorphic client** via `createClient` from `@launchdarkly/react-sdk`. The same client can be used in the browser (Client Components) and, when federated with a server client, in React Server Components. This document covers how that is implemented and how **tree-shaking** ensures that apps that do not use the server client do not bundle any server code.

## Entry points

The package has three public entry points:

| Entry | Use when | Typical bundle impact |
|-------|----------|------------------------|
| `@launchdarkly/react-sdk` | You want one client for both client and (optionally) server. Use `createClient()` and, if needed, `useServerClient(serverClient)`. | Main + client SDK. **No server code** if you never import `/server`. |
| `@launchdarkly/react-sdk/client` | You only need the browser client and React bindings (e.g. `createClient`, `createClientContext`). | Client SDK only. |
| `@launchdarkly/react-sdk/server` | You need the React server client (e.g. `createReactServerClient`) for RSC. | Server SDK only. Import only in server-only code. |

**Rule for tree-shaking:** If your app only uses `createClient` from the main entry and never imports `@launchdarkly/react-sdk/server` or calls `useServerClient`, the bundler will not include the server module in the client bundle. See [Tree-shaking](#tree-shaking) below.

## How the isomorphic client works

### Runtime behavior

The object returned by `createClient(clientSideID, context, options)` is a single instance that:

1. **Always holds a browser client** (created via the client entry). That client is used whenever code runs in a **client** environment (e.g. `typeof window !== 'undefined'`).
2. **Optionally holds a server client.** If you call `useServerClient(serverClient)`, that reference is stored. When code runs in a **server** environment (e.g. Node during RSC render), the isomorphic client delegates to this server client for evaluations.
3. **No-ops on the server when no server client is set.** If code runs on the server and you have not called `useServerClient`, evaluation methods return safe defaults (e.g. the default value you pass to `variation`) and do not run the browser SDK.

So:

- **Client-only app:** Use `createClient` from `@launchdarkly/react-sdk`. Never import `/server` or call `useServerClient`. Only the client SDK is bundled; server code is tree-shaken out.
- **App with RSC:** In server-only code, create a server client with `createReactServerClient` from `@launchdarkly/react-sdk/server`, then pass it to the isomorphic client with `useServerClient(serverClient)`. The server module is only loaded in server bundles (e.g. Next.js server chunks), not in the browser bundle.

### Delegation and no-op

- **Client environment:** All evaluation and event methods delegate to the internal browser client. Variation methods return `Promise.resolve(browserClient.variation(...))` so the API is async everywhere.
- **Server environment with server client:** All evaluation methods delegate to the federated server client (async). Events like `identify`/`track`/`flush` may no-op or resolve immediately depending on design.
- **Server environment without server client:** Variation methods return `Promise.resolve(defaultValue)`. Variation-detail methods return a result with an error reason (e.g. `CLIENT_NOT_READY`). Other methods return safe defaults (e.g. `allFlags` → `{}`, `getInitializationState` → `'unknown'`). No browser SDK code runs.

Runtime detection uses a single shared helper (e.g. `typeof window !== 'undefined'`) so it is bundler-friendly and works in Next.js (server: no `window`; client: `window` exists).

## Tree-shaking

### Why it matters

Apps that only need client-side flag evaluation should not pay the cost of the server SDK (Node/edge runtime code, server-only dependencies). The React SDK is built so that **the main entry and the isomorphic implementation do not depend on the server module at runtime**.

### How we guarantee it

1. **Type-only imports from the server module.**  
   In the main entry and in the isomorphic client implementation (e.g. `LDIsomorphicClient.ts`, `createIsomorphicClient.ts`), any reference to the server client type (e.g. `LDReactServerClient`) uses a **type-only** import:
   - `import type { LDReactServerClient } from '...'`  
   TypeScript and modern bundlers erase these at build time, so the emitted JavaScript does not reference the server module.

2. **No value imports from the server entry.**  
   The main entry and `createIsomorphicClient` must not import any **value** (function, class, or constant) from `@launchdarkly/react-sdk/server` or from internal server source files. The server client is only ever received as an argument to `useServerClient(serverClient)` and stored; it is supplied by the application, which imports from `/server` only in server-only code.

3. **Separate build outputs.**  
   The package builds separate outputs for the main entry, `client`, and `server`. The main entry’s output does not include the server entry’s code. Consumers that only import from the main entry (and never from `/server`) will not pull the server chunk into their client bundle when using a tree-shaking-aware bundler (Webpack, Rollup, Vite, Next.js).

### What you need to do

- **Client-only app:**  
  Use only `import { createClient } from '@launchdarkly/react-sdk'` (and optionally `@launchdarkly/react-sdk/client` for React context helpers). Do not import `@launchdarkly/react-sdk/server` in any file that is bundled for the browser.

- **App with RSC:**  
  Import `@launchdarkly/react-sdk/server` only in server-only modules or Server Components (e.g. layout, page, or a `lib/ld-server.ts` that is never imported by a `'use client'` component). Then the server code stays in server bundles and is not sent to the browser.

## Summary

- The isomorphic client delegates at runtime to the browser client or the federated server client, or no-ops on the server when no server client is set.
- The main entry uses **type-only** imports from the server module so that client-only consumers do not bundle any server code.
- Use the correct entry point for your environment (main for isomorphic, `/client` for browser-only, `/server` only in server code) so that bundlers can tree-shake correctly.
