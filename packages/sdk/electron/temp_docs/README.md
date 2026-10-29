# Temporary documentation

This SDK version is not out of pre-production so it will not be documented in
our official documentation site. This is a temporary location for documentation
for this SDK.

## Documentation index

- [electron.mdx](electron.mdx): a draft of the SDK reference page for the LaunchDarkly docs site.
- [MIGRATION.md](MIGRATION.md): the changes from the previous Electron SDK.
- [ipc-bridge.md](ipc-bridge.md): the design of the IPC bridge between the main process and
  renderer windows.

The sections below describe the SDK features. An HTML comment above each section names the page
on the LaunchDarkly docs site that the section updates when the SDK becomes generally available.

<!-- docs target: fern/topics/sdk/features/secure-mode.mdx#electron -->

## Credentials and secure mode

The SDK uses a **mobile key** by default. Flags must be made available to mobile SDKs in the
LaunchDarkly UI before this SDK can evaluate them.

[Secure mode](https://docs.launchdarkly.com/sdk/features/secure-mode) is not available on the
mobile key endpoints. To use secure mode, pass your **client-side ID** as the credential and set
`useClientSideId: true`, then supply the hash that your server computes for the context:

```ts
const client = createClient(
  clientSideId,
  { kind: 'user', key: 'user-key' },
  {
    useClientSideId: true,
    hash: hashFromYourServer,
  },
);
await client.start();

// A later identify can carry its own hash. It replaces the configured hash for that context.
await client.identify({ kind: 'user', key: 'other-user' }, { hash: otherHashFromYourServer });
```

When the hash is set, the SDK adds it to every polling and streaming request. Setting the `hash`
option without `useClientSideId: true` makes `createClient` throw. A `hash` passed to `identify()`
while the client uses a mobile key is ignored with a warning.

<!-- docs target: none yet (new topic) -->

## Connection modes

The client connects in `streaming` mode by default. `initialConnectionMode` selects `streaming`,
`polling`, or `offline` at start. At runtime use `setConnectionMode(mode)`, `getConnectionMode()`,
and `isOffline()`. Renderer clients expose the same three methods over IPC.

The `dataSystem` option enables the FDv2 data system (early access). Under `dataSystem`, the desktop
defaults are `streaming` with automatic mode switching disabled. The `useReport` option has no
effect. The SDK logs a warning. Use `usePost` instead. The SDK ignores `initialConnectionMode` under
`dataSystem`. Use `dataSystem.automaticModeSwitching` with `type: 'manual'` to pick the initial
mode.

<!-- docs target: none yet (new topic) -->

## Network availability

The SDK does not detect network changes on its own. When the application knows the network state
(for example from `net.isOnline()` or a renderer's `online`/`offline` events forwarded over your
own IPC), tell the main-process client:

```ts
client.setNetworkAvailability(false); // pauses the connection
client.setNetworkAvailability(true); // resumes it in the current connection mode
```

With the default data source, `false` pauses the connection and keeps the connection mode. `true`
opens the connection again in that mode. Under `dataSystem`, the SDK forwards the value to the data
system. It takes effect only when automatic network switching is enabled
(`automaticModeSwitching: true` or `{ type: 'automatic', network: true }`). Otherwise the SDK
ignores the call. An explicit call to `setConnectionMode` under `dataSystem` sets an override, and
the SDK then ignores network changes. This method exists on the main-process client only.

<!-- docs target: fern/topics/sdk/features/monitoring.mdx#electron -->

## Monitoring the data source status

The client emits `dataSourceStatus` whenever the connection state changes. The status object has a
`state` (`INITIALIZING`, `VALID`, `INTERRUPTED`, `SET_OFFLINE`, or `CLOSED`), a `stateSince`
timestamp, and an optional `lastError`.

Main process:

```ts
client.on('dataSourceStatus', (status) => {
  console.log(status.state, status.lastError?.message);
});
```

Renderer (the SDK broadcasts the same event to every subscribed window, and `on()` returns a handle
for `off()`):

```ts
const handle = client.on('dataSourceStatus', (status) => {
  console.log(status.state);
});
// later
client.off(handle);
```

<!-- docs target: fern/topics/sdk/features/local-storage.mdx#electron -->

## Flag cache storage

The SDK caches the last flag values per context so a restarted application can evaluate flags
before the first network response. By default the cache is a file named `ldcache` inside the
`ldclient-user-cache` directory under Electron's `userData` path. If the directory cannot be used,
the SDK logs a warning and keeps the cache in memory for that run.

### Encrypting the cache

Set `encryptStorage: true` to encrypt the cache with Electron's
[`safeStorage`](https://www.electronjs.org/docs/latest/api/safe-storage) API. The SDK writes the
encrypted cache to `ldcache.enc`. It deletes a plain-text `ldcache` from an earlier run and never
reads it. If `safeStorage` reports that encryption is not available, the SDK logs a warning and
keeps the cache in memory only. It never writes plain text while `encryptStorage` is `true`.
`safeStorage` works only after Electron's `ready` event, so the cache waits for that event before
its first read.

Clients with and without `encryptStorage` can run in the same process. Each mode uses its own
cache file. Each time an encrypted cache starts, it deletes the plain-text file. Do not depend on
the plain-text cache to survive a restart in that setup.

### Custom storage

Set `storage` to an object that implements `LDElectronStorage` (`get`, `set`, and `clear`, each
returning a promise) to keep the cache somewhere else. When `storage` is set, the built-in file
cache is never created and `encryptStorage` has no effect. The SDK logs errors that a custom
storage throws or rejects, and they do not reach the application. The SDK treats a failed `get` as
a missing value.

<!-- docs target: none yet (new topic) -->

## Multiple renderer windows and multiple clients

One main-process client serves any number of renderer windows. Every window gets the same flag
values. The SDK broadcasts events such as `change` and `dataSourceStatus` to every window that
subscribed.

To run more than one client in the same main process, use a different credential for each, or
set a unique `namespace` for clients that share a credential. A second client on a namespace that is
already in use throws before it registers anything. Renderer clients pass the same namespace, for
example `createRendererClient(mobileKey, 'settings-window')`.

<!-- docs target: none yet (new topic) -->

## Proxies and private certificate authorities

The SDK sends all requests through Electron's `net` module (`net.fetch`), which uses Chromium's
network stack instead of Node's `http` module. As a result:

- The operating system proxy settings apply automatically, including WPAD and PAC files.
  To override them, use Electron's own controls, for example
  `app.commandLine.appendSwitch('proxy-server', 'http://proxy.example.com:8080')` before `ready`,
  or `session.defaultSession.setProxy(...)`.
- Chromium verifies certificates. On Windows and macOS, certificate authorities that are
  trusted in the operating system store apply. On Linux, Chromium does not use the system trust
  store. It reads user-added certificate authorities from the NSS shared database. Node-only
  mechanisms such as `NODE_EXTRA_CA_CERTS` do not apply. For custom verification, Electron offers
  `session.defaultSession.setCertificateVerifyProc(...)`.

The SDK has no proxy or TLS options of its own.

<!-- docs target: fern/topics/sdk/features/relay-proxy-config/proxy-mode.mdx#electron -->

## Relay Proxy

To route traffic through the [Relay Proxy](https://docs.launchdarkly.com/home/relay-proxy), set
all three service URIs to the Relay Proxy address:

```ts
const client = createClient(mobileKey, context, {
  baseUri: 'https://relay.example.com',
  streamUri: 'https://relay.example.com',
  eventsUri: 'https://relay.example.com',
});
```
