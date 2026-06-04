# Migration Guide: `launchdarkly-vue-client-sdk` to `@launchdarkly/vue-client-sdk`

This guide covers breaking changes, removals, and additions when moving from the
standalone `launchdarkly-vue-client-sdk` (v2.x) to the new monorepo package
`@launchdarkly/vue-client-sdk` (v3+).

---

## Table of Contents

1. [Package rename](#1-package-rename)
2. [What changed](#2-what-changed)
3. [What was removed](#3-what-was-removed)
4. [What was added](#4-what-was-added)
5. [Full migration examples](#5-full-migration-examples)

---

## 1. Package rename

```
launchdarkly-vue-client-sdk  ->  @launchdarkly/vue-client-sdk
```

Update your `package.json`:

```diff
-"launchdarkly-vue-client-sdk": "^2.5.1"
+"@launchdarkly/vue-client-sdk": "^3.0.0"
```

Update all imports:

```diff
-import { LDPlugin, useLDFlag } from 'launchdarkly-vue-client-sdk';
+import { LDVuePlugin, useBoolVariation } from '@launchdarkly/vue-client-sdk';
```

---

## 2. What changed

### 2.1 Plugin name and options interface

The plugin object and its options type are renamed.

| Old | New |
|-----|-----|
| `LDPlugin` | `LDVuePlugin` |
| `LDPluginOptions` | `LDVuePluginOptions` |

```diff
-import { LDPlugin } from 'launchdarkly-vue-client-sdk';
+import { LDVuePlugin } from '@launchdarkly/vue-client-sdk';

-app.use(LDPlugin, {
-  clientSideID: 'your-client-side-id',
-  context: { kind: 'user', key: 'user-key' },
-});
+app.use(LDVuePlugin, {
+  clientSideID: 'your-client-side-id',
+  context: { kind: 'user', key: 'user-key' },
+});
```

### 2.2 Plugin options: `options` field renamed to `ldOptions`

The SDK pass-through options field is renamed to avoid collision with Vue's own
plugin options pattern.

```diff
 app.use(LDVuePlugin, {
   clientSideID: 'your-client-side-id',
   context: { kind: 'user', key: 'user-key' },
-  options: { streaming: true },
+  ldOptions: { streaming: true },
 });
```

### 2.3 `useLDFlag` replaced by typed variation composables

The generic `useLDFlag<T>(key, defaultValue)` composable is replaced by
strongly-typed composables. Each variant accepts the same parameters
(`key`, `defaultValue`), but the return type is inferred from the composable
name, not a type parameter.

| Old | New |
|-----|-----|
| `useLDFlag<boolean>(key, false)` | `useBoolVariation(key, false)` |
| `useLDFlag<string>(key, '')` | `useStringVariation(key, '')` |
| `useLDFlag<number>(key, 0)` | `useNumberVariation(key, 0)` |
| `useLDFlag<MyObject>(key, {})` | `useJsonVariation<MyObject>(key, {})` |

```diff
-import { useLDFlag } from 'launchdarkly-vue-client-sdk';
+import { useBoolVariation } from '@launchdarkly/vue-client-sdk';

-const showBanner = useLDFlag<boolean>('show-banner', false);
+const showBanner = useBoolVariation('show-banner', false);
```

All variation composables now also accept a reactive key (`Ref<string>` or
getter `() => string`), which causes re-evaluation when the key changes.

### 2.4 `useLDReady` replaced by `useInitializationStatus`

`useLDReady()` returned a simple `Readonly<Ref<boolean>>`. The new
`useInitializationStatus()` returns a `ComputedRef<InitializationStatus>` that
covers the full initialization lifecycle.

```diff
-import { useLDReady } from 'launchdarkly-vue-client-sdk';
+import { useInitializationStatus } from '@launchdarkly/vue-client-sdk';

-const isReady = useLDReady();
-if (isReady.value) { ... }
+const status = useInitializationStatus();
+if (status.value.status === 'complete') { ... }
```

`InitializationStatus` discriminates on `status`:

| Status | Meaning |
|--------|---------|
| `'initializing'` | Client has not yet resolved |
| `'complete'` | Client initialized successfully |
| `'timeout'` | Initialization timed out (uses cached/default values) |
| `'failed'` | Initialization failed; `status.value.error` contains the `Error` |

To replicate a simple "is ready" boolean:

```ts
const status = useInitializationStatus();
const isReady = computed(() => status.value.status === 'complete');
```

### 2.5 `useLDClient` return type

`useLDClient()` now returns `LDVueClient` (a superset of the base `LDClient`)
instead of `LDClient` directly. All existing `LDClient` methods remain
available; the new type adds Vue lifecycle integration helpers.

### 2.6 Deprecated `user` option removed

The `user` field on `LDPluginOptions` was deprecated in v2.x. It is not present
in `LDVuePluginOptions`. Use `context` instead.

```diff
 app.use(LDVuePlugin, {
   clientSideID: 'your-client-side-id',
-  user: { key: 'user-key' },
+  context: { kind: 'user', key: 'user-key' },
 });
```

---

## 3. What was removed

### 3.1 Low-level injection keys

The following `InjectionKey` constants are removed. The composables cover all
access patterns and should be used instead.

| Removed | Replacement |
|---------|-------------|
| `LD_INIT` | Use the `LDVuePlugin` with `deferInitialization: true` and call `client.start()` after creating the provider |
| `LD_READY` | `useInitializationStatus()` |
| `LD_CLIENT` | `useLDClient()` |
| `LD_FLAG` | `useBoolVariation` / `useStringVariation` / `useNumberVariation` / `useJsonVariation` |

### 3.2 `ldInit` composable

`ldInit(initOptions)` is removed. Deferred initialization is now handled at the
provider level.

**Before (v2):**

```ts
// In a component, after deferInitialization: true
import { ldInit } from 'launchdarkly-vue-client-sdk';
const [isReady, client] = ldInit({ clientSideID: 'id', context: { ... } });
```

**After (v3):** Create the provider with `deferInitialization: true` and call
`client.start()` when ready:

```ts
import { createLDProvider, createClient } from '@launchdarkly/vue-client-sdk';

const client = createClient('your-client-side-id', context);
const LDProvider = createLDProviderWithClient(client);

// Mount your app, then start when ready:
await client.start();
```

### 3.3 Generic `useLDFlag`

`useLDFlag<T>()` is removed. Use the type-specific composables listed in
[section 2.3](#23-useLDflag-replaced-by-typed-variation-composables).

### 3.4 `LDPlugin` and `LDPluginOptions`

Replaced by `LDVuePlugin` and `LDVuePluginOptions` respectively.

### 3.5 Implicit anonymous-user fallback

In v2, omitting `context`/`user` silently created an anonymous user context
`{ anonymous: true, kind: 'user' }`. In v3, `context` is required in
`LDVuePluginOptions` and in `createLDProvider`. Provide an explicit context.

---

## 4. What was added

### 4.1 Typed variation composables

Replaces the single generic `useLDFlag`:

```ts
import {
  useBoolVariation,
  useStringVariation,
  useNumberVariation,
  useJsonVariation,
} from '@launchdarkly/vue-client-sdk';

const enabled   = useBoolVariation('my-feature', false);
const theme     = useStringVariation('ui-theme', 'default');
const maxItems  = useNumberVariation('max-list-items', 10);
const config    = useJsonVariation<MyConfig>('app-config', defaultConfig);
```

### 4.2 Variation detail composables

Returns evaluation metadata (reason, variation index) alongside the value:

```ts
import { useBoolVariationDetail } from '@launchdarkly/vue-client-sdk';

const detail = useBoolVariationDetail('my-feature', false);
// detail.value.value      -> boolean
// detail.value.reason     -> LDEvaluationReason
// detail.value.variationIndex -> number | null
```

Available detail composables:
- `useBoolVariationDetail`
- `useStringVariationDetail`
- `useNumberVariationDetail`
- `useJsonVariationDetail`

### 4.3 Provider component API

In addition to the plugin install pattern, the SDK now exposes a composable
provider component for more flexible tree composition.

```ts
import { createLDProvider } from '@launchdarkly/vue-client-sdk';

const LDProvider = createLDProvider('your-client-side-id', context, {
  startOptions: { timeout: 5 },
});
```

Provider components support three slots for handling initialization states:

```vue
<LDProvider>
  <template #default>
    <!-- rendered when client is ready -->
    <MyApp />
  </template>
  <template #initializing>
    <LoadingSpinner />
  </template>
  <template #failed="{ error }">
    <ErrorMessage :message="error.message" />
  </template>
</LDProvider>
```

### 4.4 BYO client: `createClient` + `createLDProviderWithClient`

Decouple client creation from provider mounting for advanced patterns (testing,
SSR hydration, multi-step bootstrapping):

```ts
import { createClient, createLDProviderWithClient } from '@launchdarkly/vue-client-sdk';

const client = createClient('your-client-side-id', context);
const LDProvider = createLDProviderWithClient(client);

// Start the client independently
await client.start({ timeout: 5 });
```

### 4.5 Multiple LaunchDarkly environments

Use `createLDVueInstanceKey()` to run more than one LaunchDarkly environment in
the same application:

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

### 4.6 Bootstrap support

Provide pre-fetched flag values to eliminate the initialization waterfall:

```ts
app.use(LDVuePlugin, {
  clientSideID: 'your-client-side-id',
  context: { kind: 'user', key: 'user-key' },
  bootstrap: serverSideFlagValues, // Record<string, unknown>
});
```

### 4.7 `startOptions`

Control initialization timeout and behavior at the plugin or provider level:

```ts
app.use(LDVuePlugin, {
  clientSideID: 'your-client-side-id',
  context: { kind: 'user', key: 'user-key' },
  startOptions: { timeout: 5 }, // seconds
});
```

### 4.8 Reactive flag keys

Variation composables now accept `Ref<string>` or getter functions as the key
argument. The evaluation automatically re-runs when the key changes:

```ts
const flagKey = ref('feature-a');
const enabled = useBoolVariation(flagKey, false);

// Switch to a different flag at runtime:
flagKey.value = 'feature-b'; // `enabled` updates automatically
```

---

## 5. Full migration examples

### 5.1 Basic plugin setup

**v2:**
```ts
import { createApp } from 'vue';
import { LDPlugin } from 'launchdarkly-vue-client-sdk';
import App from './App.vue';

const app = createApp(App);
app.use(LDPlugin, {
  clientSideID: 'your-client-side-id',
  context: { kind: 'user', key: 'user-key', name: 'Sandy' },
});
app.mount('#app');
```

**v3:**
```ts
import { createApp } from 'vue';
import { LDVuePlugin } from '@launchdarkly/vue-client-sdk';
import App from './App.vue';

const app = createApp(App);
app.use(LDVuePlugin, {
  clientSideID: 'your-client-side-id',
  context: { kind: 'user', key: 'user-key', name: 'Sandy' },
});
app.mount('#app');
```

---

### 5.2 Flag evaluation in a component

**v2:**
```vue
<script setup lang="ts">
import { useLDFlag } from 'launchdarkly-vue-client-sdk';

const showBanner = useLDFlag<boolean>('show-banner', false);
const theme      = useLDFlag<string>('ui-theme', 'default');
</script>
```

**v3:**
```vue
<script setup lang="ts">
import { useBoolVariation, useStringVariation } from '@launchdarkly/vue-client-sdk';

const showBanner = useBoolVariation('show-banner', false);
const theme      = useStringVariation('ui-theme', 'default');
</script>
```

---

### 5.3 Checking initialization state

**v2:**
```vue
<script setup lang="ts">
import { useLDReady } from 'launchdarkly-vue-client-sdk';
const isReady = useLDReady();
</script>

<template>
  <div v-if="isReady">...</div>
  <div v-else>Loading...</div>
</template>
```

**v3:**
```vue
<script setup lang="ts">
import { useInitializationStatus } from '@launchdarkly/vue-client-sdk';
const status = useInitializationStatus();
</script>

<template>
  <div v-if="status.status === 'complete'">...</div>
  <div v-else-if="status.status === 'failed'">Error: {{ status.error?.message }}</div>
  <div v-else>Loading...</div>
</template>
```

---

### 5.4 Accessing the client directly

**v2:**
```ts
import { useLDClient } from 'launchdarkly-vue-client-sdk';
import type { LDClient } from 'launchdarkly-vue-client-sdk';

const client: LDClient = useLDClient();
await client.identify({ kind: 'user', key: 'new-user' });
```

**v3:**
```ts
import { useLDClient } from '@launchdarkly/vue-client-sdk';
import type { LDVueClient } from '@launchdarkly/vue-client-sdk';

const client: LDVueClient = useLDClient();
await client.identify({ kind: 'user', key: 'new-user' });
```
