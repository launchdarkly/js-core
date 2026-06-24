import type { LDContextStrict } from '@launchdarkly/js-client-sdk';
import { ref, type InjectionKey } from 'vue';

import type { InitializedState, LDVueClient, LDVueInstance } from '../LDClient';

/**
 * Creates a new injection key for a LaunchDarkly Vue instance.
 *
 * @remarks
 * Use this only when running multiple LaunchDarkly environments in the same application. Pass the
 * returned key to the provider/plugin and to the composables. For a single environment, the default
 * key is used automatically.
 */
export function createLDVueInstanceKey(): InjectionKey<LDVueInstance> {
  return Symbol('LDVueInstance') as InjectionKey<LDVueInstance>;
}

/**
 * The default injection key used by the provider, plugin, and composables.
 */
export const LDVueInstanceKey: InjectionKey<LDVueInstance> = createLDVueInstanceKey();

/**
 * Builds the reactive instance for a client by seeding refs from the client's current state and
 * subscribing to initialization-status and context changes. Returns the instance to provide and a
 * dispose function that unsubscribes.
 *
 * @internal
 */
export function createReactiveInstance(client: LDVueClient): {
  value: LDVueInstance;
  dispose: () => void;
} {
  const context = ref<LDContextStrict | undefined>(client.getContext() ?? undefined);
  const initializedState = ref<InitializedState>(client.getInitializationState());
  const error = ref<Error | undefined>(client.getInitializationError());

  const unsubscribeStatus = client.onInitializationStatusChange((result) => {
    initializedState.value = result.status;
    error.value = result.status === 'failed' ? result.error : undefined;
  });
  const unsubscribeContext = client.onContextChange((newContext) => {
    context.value = newContext;
  });

  return {
    value: { client, context, initializedState, error },
    dispose: () => {
      unsubscribeStatus();
      unsubscribeContext();
    },
  };
}
