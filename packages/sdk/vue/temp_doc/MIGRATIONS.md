---
slug: /sdk/client-side/vue/migration-2-to-3
title: Vue SDK 2.x to 3.0 migration guide
description: This topic explains the changes in the Vue SDK 3.0 release and how to migrate to that version.
published: true
keywords: vue, migration, sdk, client-side
---

This topic explains the changes in the Vue SDK 3.0 release and how to adapt code that uses a 2.x version of the [Vue SDK](/sdk/client-side/vue) to use version 3.0 or later.

**Version 3.0 includes several breaking changes**. The SDK has moved from the standalone `launchdarkly-vue-client-sdk` package into the `js-core` monorepo as `@launchdarkly/vue-client-sdk`, and now builds on the same client-side platform layer as the [JavaScript SDK](/sdk/client-side/javascript).

Before you migrate to version 3.0, update to the latest 2.x version. If you update to the latest 2.x version, compile-time deprecation warnings appear in areas of your code that need to be changed for 3.0. To learn more about updating to the latest 2.x version, visit the [SDK's GitHub repository](https://github.com/launchdarkly/vue-client-sdk).

## Package name and location changes

In v3.0 of the SDK, the package is named `@launchdarkly/vue-client-sdk`. To begin the migration, install the new package and swap all references from `launchdarkly-vue-client-sdk` to `@launchdarkly/vue-client-sdk`.

<CodeBlocks>
<CodeBlock title='npm, Vue SDK v3.0'>

```bash
npm install @launchdarkly/vue-client-sdk
```

</CodeBlock>
<CodeBlock title='npm, Vue SDK v2.x'>

```bash
npm install launchdarkly-vue-client-sdk
```

</CodeBlock>
</CodeBlocks>

Here is the import path change:

<CodeBlocks>
<CodeBlock title='Vue SDK v3.0'>

```ts
import { LDVuePlugin, useBoolVariation } from '@launchdarkly/vue-client-sdk';
```

</CodeBlock>
<CodeBlock title='Vue SDK v2.x'>

```ts
import { LDPlugin, useLDFlag } from 'launchdarkly-vue-client-sdk';
```

</CodeBlock>
</CodeBlocks>

## Plugin and options changes

In v3.0 of the SDK, the plugin object and its options type are renamed, and the SDK pass-through options field moves to a dedicated `ldOptions` property so it no longer collides with Vue's own plugin-options pattern.

| v2.x | v3.0 |
|------|------|
| `LDPlugin` | `LDVuePlugin` |
| `LDPluginOptions` | `LDVuePluginOptions` |
| `options` (SDK pass-through config) | `ldOptions` |

Here is the new plugin registration:

<CodeBlocks>
<CodeBlock title='Vue SDK v3.0'>

```ts
import { createApp } from 'vue';
import { LDVuePlugin } from '@launchdarkly/vue-client-sdk';
import App from './App.vue';

createApp(App)
  .use(LDVuePlugin, {
    clientSideID: 'example-client-side-id',
    context: { kind: 'user', key: 'example-user-key' },
    ldOptions: { streaming: true },
  })
  .mount('#app');
```

</CodeBlock>
<CodeBlock title='Vue SDK v2.x'>

```ts
import { createApp } from 'vue';
import { LDPlugin } from 'launchdarkly-vue-client-sdk';
import App from './App.vue';

createApp(App)
  .use(LDPlugin, {
    clientSideID: 'example-client-side-id',
    context: { kind: 'user', key: 'example-user-key' },
    options: { streaming: true },
  })
  .mount('#app');
```

</CodeBlock>
</CodeBlocks>

## Context changes

In v2.x, `context` and a deprecated `user` field could both be passed to the plugin; `context` took precedence when both were present. If you omitted both, the SDK silently created an anonymous user context (`{ anonymous: true, kind: 'user' }`).

In v3.0, the deprecated `user` field is removed, and `context` is a required field on `LDVuePluginOptions`, and a required parameter of `createLDProvider` and `createClient`. There is no implicit anonymous-context fallback: if you want an anonymous context, construct one explicitly.

<CodeBlocks>
<CodeBlock title='Vue SDK v3.0, explicit anonymous context'>

```ts
app.use(LDVuePlugin, {
  clientSideID: 'example-client-side-id',
  context: { kind: 'user', anonymous: true },
});
```

</CodeBlock>
<CodeBlock title='Vue SDK v2.x, omitted context'>

```ts
// Omitting context/user previously fell back to an anonymous context automatically.
app.use(LDPlugin, {
  clientSideID: 'example-client-side-id',
});
```

</CodeBlock>
</CodeBlocks>

## Client initialization

In v3.0 of the SDK, there are two ways to create and provide the client:

- `LDVuePlugin`, installed with `app.use()`, provides the client app-wide.
- `createLDProvider`, which returns a component you render in your template. Unlike the plugin, the provider component supports `initializing` and `failed` slots so you can gate rendering on initialization state without a separate composable call.

Both start the client immediately unless you pass `deferInitialization: true`, in which case you call `client.start()` yourself, typically after retrieving the client with `useLDClient()`. The v2.x `ldInit()` composable and the `LD_INIT` injection key it relied on are both removed; there is no longer a way for a descendant component to create the client, since the client now always exists as soon as the plugin or provider runs.

Here is the new client initialization:

<CodeBlocks>
<CodeBlock title='Vue SDK v3.0'>

```ts
import { createApp } from 'vue';
import { LDVuePlugin } from '@launchdarkly/vue-client-sdk';
import App from './App.vue';

createApp(App)
  .use(LDVuePlugin, {
    clientSideID: 'example-client-side-id',
    context: { kind: 'user', key: 'example-user-key' },
  })
  .mount('#app');
```

</CodeBlock>
<CodeBlock title='Vue SDK v2.x'>

```ts
import { createApp } from 'vue';
import { LDPlugin } from 'launchdarkly-vue-client-sdk';
import App from './App.vue';

createApp(App)
  .use(LDPlugin, {
    clientSideID: 'example-client-side-id',
    context: { kind: 'user', key: 'example-user-key' },
  })
  .mount('#app');
```

</CodeBlock>
</CodeBlocks>

Here is the new deferred-initialization pattern:

<CodeBlocks>
<CodeBlock title='Vue SDK v3.0'>

```ts
// main.ts
app.use(LDVuePlugin, {
  clientSideID: 'example-client-side-id',
  context: { kind: 'user', key: 'example-user-key' },
  deferInitialization: true,
});

// Later, in a component:
import { useLDClient } from '@launchdarkly/vue-client-sdk';
const client = useLDClient();
await client.start();
```

</CodeBlock>
<CodeBlock title='Vue SDK v2.x'>

```ts
// main.ts
app.use(LDPlugin, { deferInitialization: true });

// In a component:
import { ldInit } from 'launchdarkly-vue-client-sdk';
const [isReady, client] = ldInit({
  clientSideID: 'example-client-side-id',
  context: { kind: 'user', key: 'example-user-key' },
});
```

</CodeBlock>
</CodeBlocks>

For advanced patterns such as testing or multi-step bootstrapping, `createClient` and `createLDProviderWithClient` let you create and own the client instance separately from the provider component that renders it. This pattern has no v2.x equivalent.

<CodeBlocks>
<CodeBlock title='Vue SDK v3.0, BYO client'>

```ts
import { createClient, createLDProviderWithClient } from '@launchdarkly/vue-client-sdk';

const client = createClient('example-client-side-id', { kind: 'user', key: 'example-user-key' });
const LDProvider = createLDProviderWithClient(client);

await client.start({ timeout: 5 });
```

</CodeBlock>
</CodeBlocks>

The v3.0 SDK also adds `startOptions` and `bootstrap`, which control timeout and bootstrap data at the plugin or provider level:

<CodeBlocks>
<CodeBlock title='Vue SDK v3.0'>

```ts
app.use(LDVuePlugin, {
  clientSideID: 'example-client-side-id',
  context: { kind: 'user', key: 'example-user-key' },
  startOptions: { timeout: 5 },
  bootstrap: serverSideFlagValues,
});
```

</CodeBlock>
</CodeBlocks>

## Initialization status changes

In v2.x, `useLDReady()` returned a `Readonly<Ref<boolean>>`, backed by the `LD_READY` injection key.

In v3.0, `useLDReady` and `LD_READY` are both removed. `useInitializationStatus()` returns a `ComputedRef<InitializationStatus>`, a discriminated union covering the full initialization lifecycle: `'initializing'`, `'complete'`, `'timeout'`, or `'failed'` (with an `error` field).

<CodeBlocks>
<CodeBlock title='Vue SDK v3.0'>

```vue
<script setup lang="ts">
import { useInitializationStatus } from '@launchdarkly/vue-client-sdk';
const status = useInitializationStatus();
</script>

<template>
  <div v-if="status.status === 'complete'">Ready</div>
  <div v-else-if="status.status === 'failed'">Error: {{ status.error.message }}</div>
  <div v-else>Loading...</div>
</template>
```

</CodeBlock>
<CodeBlock title='Vue SDK v2.x'>

```vue
<script setup lang="ts">
import { useLDReady } from 'launchdarkly-vue-client-sdk';
const isReady = useLDReady();
</script>

<template>
  <div v-if="isReady">Ready</div>
  <div v-else>Loading...</div>
</template>
```

</CodeBlock>
</CodeBlocks>

To replicate the v2.x boolean, derive it with `computed`:

```ts
const status = useInitializationStatus();
const isReady = computed(() => status.value.status === 'complete');
```

## Flag evaluation changes

In v2.x, the generic `useLDFlag<T>(key, defaultValue)` composable, backed by the `LD_FLAG` injection key, evaluated any flag type through a type parameter.

In v3.0, `useLDFlag` and `LD_FLAG` are both removed. Flag evaluation now has typed composables: `useBoolVariation`, `useStringVariation`, `useNumberVariation`, and `useJsonVariation`. Each accepts the same `key` and `defaultValue` parameters; the return type is inferred from the composable name rather than a type parameter.

<CodeBlocks>
<CodeBlock title='Vue SDK v3.0'>

```vue
<script setup lang="ts">
import { useBoolVariation, useStringVariation } from '@launchdarkly/vue-client-sdk';

const showBanner = useBoolVariation('show-banner', false);
const theme = useStringVariation('ui-theme', 'default');
</script>
```

</CodeBlock>
<CodeBlock title='Vue SDK v2.x'>

```vue
<script setup lang="ts">
import { useLDFlag } from 'launchdarkly-vue-client-sdk';

const showBanner = useLDFlag<boolean>('show-banner', false);
const theme = useLDFlag<string>('ui-theme', 'default');
</script>
```

</CodeBlock>
</CodeBlocks>

Each typed composable also has a `*VariationDetail` counterpart that returns the full evaluation detail, including the reason and variation index. This has no v2.x equivalent:

<CodeBlocks>
<CodeBlock title='Vue SDK v3.0'>

```ts
import { useBoolVariationDetail } from '@launchdarkly/vue-client-sdk';

const detail = useBoolVariationDetail('my-feature', false);
// detail.value.value          -> boolean
// detail.value.reason         -> LDEvaluationReason
// detail.value.variationIndex -> number | null
```

</CodeBlock>
</CodeBlocks>

In v3.0, every variation composable also accepts a reactive key, either a `Ref<string>` or a getter function, so a component can switch which flag it evaluates at runtime without unmounting:

<CodeBlocks>
<CodeBlock title='Vue SDK v3.0'>

```ts
const flagKey = ref('feature-a');
const enabled = useBoolVariation(flagKey, false);

flagKey.value = 'feature-b'; // `enabled` re-evaluates automatically
```

</CodeBlock>
</CodeBlocks>

## Client access changes

In v2.x, `useLDClient()`, backed by the `LD_CLIENT` injection key, returned the base `LDClient` from the underlying JavaScript SDK.

In v3.0, `LD_CLIENT` is removed, and `useLDClient()` returns `LDVueClient`, a superset of `LDClient` that adds `getInitializationState()`, `getInitializationError()`, `onContextChange()`, `onInitializationStatusChange()`, and `isReady()`. All existing `LDClient` methods remain available.

<CodeBlocks>
<CodeBlock title='Vue SDK v3.0'>

```ts
import { useLDClient } from '@launchdarkly/vue-client-sdk';
import type { LDVueClient } from '@launchdarkly/vue-client-sdk';

const client: LDVueClient = useLDClient();
await client.identify({ kind: 'user', key: 'new-user' });
```

</CodeBlock>
<CodeBlock title='Vue SDK v2.x'>

```ts
import { useLDClient } from 'launchdarkly-vue-client-sdk';
import type { LDClient } from 'launchdarkly-vue-client-sdk';

const client: LDClient = useLDClient();
await client.identify({ kind: 'user', key: 'new-user' });
```

</CodeBlock>
</CodeBlocks>

## Running multiple LaunchDarkly environments

Version 3.0 adds `createLDVueInstanceKey()`, which creates a Vue `InjectionKey` you can pass to a provider or plugin's `injectionKey` option and to any composable's optional `injectionKey` parameter. This lets you run more than one LaunchDarkly environment in the same application. This has no v2.x equivalent.

<CodeBlocks>
<CodeBlock title='Vue SDK v3.0'>

```ts
import {
  createLDVueInstanceKey,
  createLDProvider,
  useBoolVariation,
} from '@launchdarkly/vue-client-sdk';

const experimentKey = createLDVueInstanceKey();

const ExperimentProvider = createLDProvider('experiment-client-id', context, {
  injectionKey: experimentKey,
});

// In a child component:
const inExperiment = useBoolVariation('experiment-flag', false, experimentKey);
```

</CodeBlock>
</CodeBlocks>

## Identifying supported Vue versions for the 3.0 SDK

The Vue SDK 3.0 requires Vue 3.3 or newer, up from Vue 3.2.36 in the 2.x line. The reactive flag keys described in [Flag evaluation changes](#flag-evaluation-changes) use Vue's `toValue` and `MaybeRefOrGetter`, which were introduced in Vue 3.3.
