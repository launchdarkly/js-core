# Migrating to this SDK

Below are some breaking changes between this SDK major version
and the previous [Electron SDK](https://github.com/launchdarkly/electron-client-sdk)

## SDK initialization (createClient and start)
> NOTE: LDClient **MUST** be run in the main process.

The main-process entry point is now **`createClient`** (replacing `initializeInMain`). Update any references accordingly.

- **New signature:** `createClient(credential, initialContext, options)` — the **initial context is required** as the second argument, aligned with the browser SDK’s `createClient`.

- **Must call `start()`:** The client is not ready until `start()` is called. After `createClient()`, the app must call `client.start()` (optionally with `LDStartOptions`: `timeout`, `bootstrap`, `identifyOptions`). The promise returned by `start()` resolves when the first identify completes (or times out or fails).

- **No `identify()` before `start()`:** Calling `identify()` before `start()` is an error (logged and rejected). Use `identify()` only after `start()` has been called, for subsequent context changes.

Example:

```typescript
const client = createClient(launchDarklyMobileKey, launchDarklyUser, launchDarklyOptions);
await client.start();
// Later, when changing context:
await client.identify(newUser);
```

## Identify flow (identify returns result, does not throw)

`identify()` now returns a **promise that always resolves** to an `LDIdentifyResult` object. It does **not** throw; success or failure is indicated by the resolved value.

- **Return type:** `Promise<LDIdentifyResult>`
- **Result statuses:**
  - `{ status: 'completed' }` — identification succeeded.
  - `{ status: 'error', error: Error }` — identification failed (e.g. called before `start()`, invalid context, or network error).
  - `{ status: 'timeout', timeout: number }` — identification did not complete within the configured timeout.
  - `{ status: 'shed' }` — the identify was shed (e.g. when using `sheddable: true` and a newer identify superseded it).

**Before (throwing):**

```typescript
try {
  await client.identify(newUser);
  // success
} catch (err) {
  // handle error or timeout
}
```

**After (result object):**

```typescript
const result = await client.identify(newUser);
if (result.status === 'completed') {
  // success
} else if (result.status === 'error') {
  // result.error
} else if (result.status === 'timeout') {
  // result.timeout (seconds)
}
```

You can still `await client.identify(context)` without inspecting the result if you do not need to handle errors or timeouts explicitly.

## Use Mobile SDK key

This SDK now uses the **mobile key** by default instead of the client-side ID. If you were previously passing a client-side ID to initialize the SDK, you should switch to your environment’s mobile key (from **Account settings** → **Projects** → your project → **Environments** → **Mobile key**).

- **Continue using the client-side ID:** If you need to keep your existing behavior, pass `useClientSideId: true` in options when calling creating the SDK instance. This option is deprecated and may be removed in a future major version; prefer migrating to the mobile key when possible.

- **Enable flags for mobile SDKs:** By default, flags are only available to server-side SDKs. For the Electron SDK (using the mobile key) to evaluate a flag, you must make that flag available to **SDKs using Mobile Key** in the LaunchDarkly UI. When creating a new flag, check the appropriate box in the "Create flag" dialog; for existing flags, use the **Advanced controls** section in the flag’s right sidebar. See [Make flags available to client-side and mobile SDKs](https://launchdarkly.com/docs/home/flags/new#make-flags-available-to-client-side-and-mobile-sdks) in the LaunchDarkly docs.

- **Secure Mode:** Mobile key–based SDKs do not support [Secure Mode](https://docs.launchdarkly.com/sdk/features/secure-mode). If your application depends on Secure Mode (for example, to verify flag values in a trusted backend), you must use the client-side ID with `useClientSideId: true` instead of the mobile key.