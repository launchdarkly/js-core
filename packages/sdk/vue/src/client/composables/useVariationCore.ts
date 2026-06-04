import {
  onScopeDispose,
  readonly,
  ref,
  toValue,
  watch,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';

import type { LDVueClient, LDVueInstance } from '../LDClient';
import { injectLDVueInstance } from './useLDClient';

/**
 * Shared core for the variation composables. Evaluates a flag and keeps the returned ref in sync.
 *
 * @remarks
 * Re-evaluates on two independent triggers:
 *  - the flag's value changing (`change:<key>` event), and
 *  - the context changing, via {@link LDVueClient.onContextChange}, which fires for every settled
 *    `start()` outcome (complete, timeout, failed) and for every completed `identify()`.
 * 
 * This means that there is a possible case that we evaluate the flag 2x when switching
 * contexts (both triggers fire). This is expected behavior for now as it is more stable
 * than to try to optimize and consolidate 2 unrelated signals.
 *
 * @internal
 */
export function useVariationCore<T, R = T>(
  key: MaybeRefOrGetter<string>,
  defaultValue: T,
  evaluate: (client: LDVueClient, key: string, defaultValue: T) => R,
  injectionKey?: InjectionKey<LDVueInstance>,
  notReadyDefault?: (defaultValue: T) => R,
): Readonly<Ref<R>> {
  const { client } = injectLDVueInstance(injectionKey);

  const evaluateValue = (): R => {
    if (client.isReady()) {
      return evaluate(client, toValue(key), defaultValue);
    }
    return notReadyDefault ? notReadyDefault(defaultValue) : (defaultValue as unknown as R);
  };

  const valueRef = ref(evaluateValue()) as Ref<R>;
  const update = () => {
    valueRef.value = evaluateValue();
  };

  // Flag-value trigger (see @remarks above).
  let currentKey = toValue(key);
  client.on(`change:${currentKey}`, update);

  // Context/init-outcome-driven re-evaluation: the single trigger for every settled
  // start()/identify() outcome. Keeping this as the only such subscription prevents the
  // SDK-2640 double-eval-on-failure regression.
  const unsubscribeContext = client.onContextChange(update);

  // Only the key needs to be reactive here; a new key means the old change:<key> subscription
  // is stale and has to move with it.
  const stopWatch = watch(
    () => toValue(key),
    (newKey) => {
      client.off(`change:${currentKey}`, update);
      currentKey = newKey;
      client.on(`change:${currentKey}`, update);
      // re-evaluate now; the new key's change event may never fire if its value hasn't changed
      update();
    },
  );

  onScopeDispose(() => {
    // client.on/onContextChange are plain event-emitter subscriptions, invisible to Vue's
    // reactivity system, so they leak on unmount unless torn down explicitly here.
    client.off(`change:${currentKey}`, update);
    unsubscribeContext();
    stopWatch();
  });

  return readonly(valueRef) as Readonly<Ref<R>>;
}
