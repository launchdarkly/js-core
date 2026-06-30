import {
  onScopeDispose,
  readonly,
  ref,
  shallowRef,
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
 * Re-evaluates when the flag changes (`change:<key>` event), the key changes, the context changes
 * (after `identify()`), or the client becomes ready. The base SDK emits `change:<key>` with the
 * context, not the new value, so we always call the client rather than reading the event payload.
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
  const { client, context, initializedState } = injectLDVueInstance(injectionKey);

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

  let currentKey = toValue(key);

  const flagChanged = shallowRef(0);
  const changeHandler = () => {
    flagChanged.value += 1;
  };
  client.on(`change:${currentKey}`, changeHandler);

  // Batch all synchronous source mutations into one watch run.
  const stop = watch([() => toValue(key), context, initializedState, flagChanged], ([newKey]) => {
    if (newKey !== currentKey) {
      client.off(`change:${currentKey}`, changeHandler);
      currentKey = newKey;
      client.on(`change:${currentKey}`, changeHandler);
    }
    update();
  });

  onScopeDispose(() => {
    client.off(`change:${currentKey}`, changeHandler);
    stop();
  });

  return readonly(valueRef) as Readonly<Ref<R>>;
}
