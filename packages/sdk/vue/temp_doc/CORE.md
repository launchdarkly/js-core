# Vue SDK core doc changes (v2 -> v3)

Tracks what needs to change in the live language reference page,
<https://launchdarkly.com/docs/sdk/client-side/vue>, now that the SDK has moved from
`launchdarkly-vue-client-sdk` (old repo: `launchdarkly/vue-client-sdk`) to
`@launchdarkly/vue-client-sdk` v3 in `js-core`. Not a draft of the replacement page -- a change
list to work from when editing the real `.mdx` source in `ld-docs-private`. Structured against the
canonical layout in the [[sdk-language-guide]] skill (see
`fern/topics/sdk/client-side/javascript/index.mdx` as the reference example), so items below also
call out where the current page's structure diverges from that canonical layout independent of the
v2->v3 rename.

Current-page content below is taken from a live fetch of the page (2026-07-09); exact admonition
types (Note vs. Warning vs. Tip) couldn't be confirmed from the rendered page and need checking
against the real `.mdx` source once this is edited in `ld-docs-private`.

## Structural changes (independent of the v3 rename)

The current page nests `Understand version compatibility` as an `### ` under `## Get started`.
The canonical template puts environment/runtime-support content in its own top-level section
(`## Browser support`, `## Runtime requirements`, etc.) placed *before* `## Get started`, not
nested inside it. Recommend pulling this out into a new `## Runtime requirements` section.

The current page has no `## Supported features` section at all. This is always the last section
per the template. Needs to be added (see below).

The current page has no `## Shut down the client` section. `LDVueClient` extends the base
`LDClient`, which exposes `close(): Promise<void>`, so this section is addable now regardless of
the v3 migration.

The current page folds flag-change subscription behavior into the `Retrieve flag values for the
context` prose rather than giving it its own sibling section (`## Subscribe to flag changes`),
unlike the JS SDK's page. Lower priority than the other gaps since the Vue composables
auto-subscribe by default, but worth adding once `useLDClient()` access is documented, since that
exposes raw `client.on('change', ...)` for advanced use.

The `## Get started` section has no roadmap bullet list under the intro sentence (the canonical
example links to `#install-the-sdk`, `#initialize-the-client`, etc. right after
`/home/getting-started`). Needs to be added once the H3s below are finalized.

## SDK quick links callout

| Row | Current (v2.x) | Required for v3 |
|---|---|---|
| SDK API documentation | `https://launchdarkly.github.io/vue-client-sdk/` | Likely `https://launchdarkly.github.io/js-core/packages/sdk/vue/docs/`, matching the browser SDK's pattern (`.../packages/sdk/browser/docs/`) -- **unverified, confirm once typedoc publishes for this package** |
| Supported SDK Versions | `../concepts/supported-versions#vue-sdk` | Unchanged, anchor should still resolve |
| GitHub repository | `https://github.com/launchdarkly/vue-client-sdk` | `https://github.com/launchdarkly/js-core/tree/main/packages/sdk/vue` (confirmed via `package.json` `homepage` field) |
| Sample application | `.../vue-client-sdk/tree/main/example` | `https://github.com/launchdarkly/js-core/tree/main/packages/sdk/vue/examples/getting-started` (confirmed exists at that path; there are also feature-specific examples under `examples/features/` -- e.g. `data-saving-mode`, `identify-eval-count` -- worth a short mention alongside the primary sample link, following the pattern other js-core SDK pages use for feature examples) |
| Published module | npm `launchdarkly-vue-client-sdk` | npm `@launchdarkly/vue-client-sdk` |

## Runtime requirements (new top-level section, or keep as `### ` -- see Structural changes)

Current text: "Vue SDK 2.0 requires Vue 3.2 or newer" / "Vue SDK 1.x requires Vue 3 or newer." For
Vue 2 users, recommends the JS SDK directly or the community `vue-ld` package.

Required change: state "Vue SDK 3.0 requires Vue 3.3 or newer" (peer dep bumped `^3.2.36` ->
`^3.3.0`; confirmed in `packages/sdk/vue/package.json`). The reactive-flag-key feature (`toValue`,
`MaybeRefOrGetter`) is why the floor moved to 3.3. Keep the Vue-2/`vue-ld` guidance as-is --
unaffected by this migration.

## Install the SDK

Current install commands reference `launchdarkly-vue-client-sdk`; update to
`@launchdarkly/vue-client-sdk`. Optional observability/session-replay plugin install commands are
unchanged (`@launchdarkly/observability`, `@launchdarkly/session-replay`).

Current text says the plugins "require Vue SDK version 2.4 or later." **Open question for docs
team**: what's the right minimum-version phrasing for a fresh v3 package? Plugins pass through via
the renamed `ldOptions` field from the first v3 release, so there's no natural version gate the way
there was within the 2.x line -- may be simplest to drop the version qualifier entirely for v3.

## Configure the SDK

Current text and code sample reference `LDPlugin`, `app.use(LDPlugin, { clientSideID, ... })`, and
a nested `options` field (holding `plugins`). All three change:

- `LDPlugin` -> `LDVuePlugin`
- `options: { plugins: [...] }` -> `ldOptions: { plugins: [...] }`
- Current text: "config can be passed to the plugin or to `ldInit`" -- `ldInit` no longer exists in
  v3, remove this clause. Deferred initialization in v3 is `deferInitialization: true` plus calling
  `client.start()` yourself later via `useLDClient()` (see Client initialization section below).

Also worth adding here: v3 has a second, provider-component way to configure the SDK
(`createLDProvider`), not just the plugin. The current page only documents the plugin pattern. At
minimum this section should note the provider exists and link to where it's documented (its main
advantage over the plugin is slot-based gating on initialization state -- see "Determine when the
client is ready" below).

Client-side ID / dev-server guidance (client-side IDs not secret, `ldcli` dev-server on
`localhost:8765` using project key instead of client-side ID) is unrelated to the SDK's own API and
should carry over unchanged.

## Initialize the client and context

Current text explains auto-init unless `deferInitialization`, recommends
`waitForInitialization()` with a <=5s timeout, and shows a `<script setup>` example using `ldInit`
and `v-if="ldReady"`.

Required changes:

- The `ldInit` code sample no longer applies; remove it.
- v3's idiomatic pattern is `useInitializationStatus()` (see next section) rather than calling the
  base `waitForInitialization()` method directly inside a component -- update the recommendation to
  point there first, and mention that `LDVueClient` (returned by `useLDClient()`) still exposes the
  full base `LDClient`, including `waitForInitialization()` and `.on('ready', ...)`, for advanced
  cases that bypass the composables.
- `deferInitialization` still exists in v3 with the same name and default (`false`), but the
  deferred-init story changes: in v2 a descendant component called `ldInit(options)` to create the
  client; in v3 the client already exists (created by the plugin/provider at setup time) and you
  just call `.start()` on it later. Worth an explicit code sample given how easy this is to get
  wrong coming from v2 muscle memory.

## Determine when the client is ready

Current text: `ldReady` is a plain `ref`, obtained from `ldInit`'s return tuple or via
`useLDReady()`.

Required changes:

- `useLDReady()` is removed; replace with `useInitializationStatus()`, which returns a
  `ComputedRef<{ status: 'initializing' | 'complete' | 'timeout' | 'failed', error?: Error }>`
  rather than a plain boolean. Update the template example from `v-if="ldReady"` to
  `v-if="status.status === 'complete'"` (and add a `failed` branch, since that's new information
  the discriminated union exposes that the old boolean couldn't).
- Consider wrapping the "call `useInitializationStatus()`" pattern and the "use the raw
  `LDVueClient` events/promises" pattern (from the note above) in `<Accordion>` tabs, mirroring how
  the JS SDK page presents events vs. promises as alternate mechanisms -- optional, since Vue only
  really has one first-class mechanism (the composable), but worth considering if we want to
  document the escape hatch prominently.

## Retrieve flag values for the context

Current text and sample center entirely on the generic `useLDFlag(featureFlagKey, fallbackValue)`.
This section needs the largest rewrite:

- `useLDFlag` is removed. Replace with the typed composables: `useBoolVariation`,
  `useStringVariation`, `useNumberVariation`, `useJsonVariation`. Each takes the same
  `(key, defaultValue)` shape; the type comes from the composable name instead of a type parameter.
- Add the `*VariationDetail` composables (`useBoolVariationDetail`, etc.) as a follow-on -- no v2
  equivalent existed for evaluation detail/reasons in this SDK.
- Add a note on reactive keys: every variation composable accepts `Ref<string>` or a getter for
  `key`, re-evaluating automatically when the key changes -- no v2 equivalent.
- Keep the existing content about auto-subscription to flag-change events, the `streaming: false`
  escape hatch, and the "flags must be marked available to client-side SDKs" callout -- all
  unchanged in v3 (confirmed: `useVariationCore` still listens on `change:<key>` under the hood).
- The current section title ("Retrieve flag values for the context") could stay, or be renamed to
  something like "Evaluate flags" to match how other pages title this -- no strong preference,
  flagging as a style call for whoever edits the real page.

## Access the underlying JavaScript SDK

Current text: `useLDClient()` returns the underlying `LDClient`.

Required change: `useLDClient()` now returns `LDVueClient`, a superset of `LDClient` with
`getInitializationState()`, `getInitializationError()`, `onContextChange()`,
`onInitializationStatusChange()`, and `isReady()` added on top. All existing `LDClient` methods
(`variation`, `identify`, `close`, `on`, `waitForInitialization`, etc.) remain available unchanged.
Update the code sample's import and type annotation from `LDClient` to `LDVueClient`.

## Shut down the client (new section to add)

No current equivalent on this page. `LDVueClient` inherits `close(): Promise<void>` from the base
`LDClient`. Recommend adding a short section here mirroring the JS SDK's `## Shut down the client`,
linking to `/sdk/features/shutdown#javascript` if a Vue-specific anchor doesn't exist yet on that
shared feature page.

## Example app

Current text points to `launchdarkly/vue-client-sdk`'s `main/example` directory. Update to
`https://github.com/launchdarkly/js-core/tree/main/packages/sdk/vue/examples/getting-started`
(same link as the "Sample application" quick-links row). There are also narrower feature examples
under `examples/features/` (`data-saving-mode`, `identify-eval-count`) that could be called out if
this page starts linking to per-feature examples the way some other js-core SDK pages do -- not
required, just an option.

## Troubleshooting

Current content (the `LaunchDarklyFlagFetchError: network error` KB link) is generic to the
underlying JS SDK's network layer and should carry over unchanged.

## Supported features (new section to add)

No current section. Per the template, this is always last, alphabetically sorted, links-only, no
hand-written descriptions. Starter candidate list based on what's confirmed present in the v3 SDK
today -- **needs docs-team review before publishing**, since it means committing to which shared
feature pages have (or need) a Vue-specific anchor:

- Bootstrapping (`bootstrap` option on the plugin/provider)
- Evaluating flags (variation composables)
- Evaluation reasons (`*VariationDetail` composables)
- Identifying and changing contexts (`client.identify()` via `useLDClient()`)
- Shutting down (`client.close()` via `useLDClient()`)
- Subscribing to flag changes (auto-subscription in variation composables; raw `client.on()` via
  `useLDClient()`)

Likely candidates that need verification against actual SDK behavior before listing (not confirmed
during this pass -- see the source files under `packages/sdk/vue/src` if picking this up):
private attributes, secure mode, service endpoint configuration, SDK configuration/application
metadata, logging, hooks, inspectors.
