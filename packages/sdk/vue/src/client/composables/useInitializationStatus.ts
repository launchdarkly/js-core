import { computed, type ComputedRef, type InjectionKey } from 'vue';

import type { InitializationStatus, LDVueInstance } from '../LDClient';
import { injectLDVueInstance } from './useLDClient';

/**
 * Returns a reactive {@link InitializationStatus} for the client: `{ status: 'initializing' | 'complete'
 * | 'timeout' }`, or `{ status: 'failed', error }` when initialization failed. Use it to gate rendering
 * until the client is ready.
 *
 * @param injectionKey optional injection key for multiple environments @see {@link createLDVueInstanceKey}
 */
export function useInitializationStatus(
  injectionKey?: InjectionKey<LDVueInstance>,
): ComputedRef<InitializationStatus> {
  const { initializedState, error } = injectLDVueInstance(injectionKey);
  return computed<InitializationStatus>(() => {
    if (initializedState.value === 'failed') {
      return { status: 'failed', error: error.value ?? new Error('Initialization failed') };
    }
    return { status: initializedState.value };
  });
}
