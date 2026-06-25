import type { LDContext } from '@launchdarkly/js-client-sdk';
import { defineComponent, onScopeDispose, provide, type InjectionKey } from 'vue';

import type { LDVueClient, LDVueInstance } from '../LDClient';
import type { LDVueProviderOptions } from '../LDOptions';
import { createClient } from '../LDVueClient';
import { createReactiveInstance, LDVueInstanceKey } from './LDVueContext';

/**
 * Creates a LaunchDarkly provider component that wraps an existing client.
 *
 * @remarks
 * **NOTE:** We recommend using {@link createLDProvider} instead of this function if you can.
 *
 * This factory is provided to allow the caller to use an existing client instance. When using this
 * function, the caller is responsible for calling `client.start()` before or after mounting.
 *
 * The returned component renders its default slot. It also supports optional `initializing` and
 * `failed` slots: when provided, they render instead of the default slot while the client is
 * initializing or after it has failed (the `failed` slot receives an `error` prop).
 *
 * @example
 * ```ts
 * import { createClient, createLDProviderWithClient } from '@launchdarkly/vue-client-sdk';
 *
 * const client = createClient('your-client-side-id', { kind: 'user', key: 'user-key' });
 * client.start();
 * const LDProvider = createLDProviderWithClient(client);
 * ```
 *
 * For multiple client instances, pass a custom injection key:
 * ```ts
 * const key = createLDVueInstanceKey();
 * const LDProvider = createLDProviderWithClient(client, key);
 * ```
 *
 * @remarks
 * When nesting providers with the same injection key, the inner provider silently shadows the
 * outer one for its descendants. Use {@link createLDVueInstanceKey} for each environment to
 * avoid this.
 *
 * @param client a LaunchDarkly Vue client @see {@link createClient}
 * @param injectionKey optional injection key for multiple environments @see {@link createLDVueInstanceKey}
 */
export function createLDProviderWithClient(
  client: LDVueClient,
  injectionKey: InjectionKey<LDVueInstance> = LDVueInstanceKey,
) {
  return defineComponent({
    name: 'LDProvider',
    setup(_, { slots }) {
      const { value, dispose } = createReactiveInstance(client);
      provide(injectionKey, value);
      onScopeDispose(dispose);

      return () => {
        const state = value.initializedState.value;
        if (state === 'initializing' && slots.initializing) {
          return slots.initializing();
        }
        if (state === 'failed' && slots.failed) {
          return slots.failed({ error: value.error.value });
        }
        return slots.default?.();
      };
    },
  });
}

/**
 * Creates a LaunchDarkly provider component, creating the client internally.
 *
 * By default the client starts immediately (before the provider mounts). Pass
 * `deferInitialization: true` in options to opt out of auto-start and call
 * `client.start()` yourself via {@link useLDClient}.
 *
 * @example
 * ```ts
 * import { createLDProvider } from '@launchdarkly/vue-client-sdk';
 * import { createApp, h } from 'vue';
 * import App from './App.vue';
 *
 * const LDProvider = createLDProvider('your-client-side-id', { kind: 'user', key: 'user-key' });
 *
 * createApp({
 *   render: () => h(LDProvider, null, { default: () => h(App) }),
 * }).mount('#app');
 * ```
 *
 * @param clientSideID the LaunchDarkly client-side ID
 * @param context the initial LaunchDarkly context
 * @param options optional provider and client options
 */
export function createLDProvider(
  clientSideID: string,
  context: LDContext,
  options: LDVueProviderOptions = {},
) {
  const { deferInitialization, startOptions, ldOptions, bootstrap, injectionKey } = options;

  const client = createClient(clientSideID, context, ldOptions);

  if (!deferInitialization) {
    const effectiveStartOptions = bootstrap ? { ...startOptions, bootstrap } : startOptions;
    client.start(effectiveStartOptions);
  }

  return createLDProviderWithClient(client, injectionKey);
}
