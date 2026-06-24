import { inject, type InjectionKey } from 'vue';

import type { LDVueClient, LDVueInstance } from '../LDClient';
import { LDVueInstanceKey } from '../provider/LDVueContext';

/**
 * Injects the LaunchDarkly instance, throwing a descriptive error if no provider/plugin is
 * present. Internal helper shared by the composables.
 *
 * @internal
 */
export function injectLDVueInstance(
  injectionKey: InjectionKey<LDVueInstance> = LDVueInstanceKey,
): LDVueInstance {
  const ctx = inject(injectionKey);
  if (!ctx) {
    throw new Error(
      'LaunchDarkly client was not found. Wrap your app in a provider from createLDProvider() or install LDVuePlugin via app.use().',
    );
  }
  return ctx;
}

/**
 * Returns the LaunchDarkly client. Must be called within a component tree provided by
 * {@link createLDProvider} or the {@link LDVuePlugin}.
 *
 * @param injectionKey optional injection key for multiple environments @see {@link createLDVueInstanceKey}
 */
export function useLDClient(
  injectionKey?: InjectionKey<LDVueInstance>,
): LDVueClient {
  return injectLDVueInstance(injectionKey).client;
}
