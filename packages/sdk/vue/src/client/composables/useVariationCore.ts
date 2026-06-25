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
 * The flag key may be a plain string, a ref, or a getter, so callers can drive a reactive key. The
 * value is re-evaluated when: the flag changes (`change:<key>` event), the key changes, the context
 * changes (after `identify()`), or the client becomes ready. The base SDK emits `change:<key>` with
 * the context (not the new value), so we always re-evaluate via the client rather than reading an
 * event payload.
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
  const changeHandler = () => {
    update();
  };
  client.on(`change:${currentKey}`, changeHandler);

  // Re-subscribe when the key changes; re-evaluate when the key, context, or readiness changes.
  // Both the change-event handler and the context watch may call evaluate() on a single identify().
  const stop = watch([() => toValue(key), context, initializedState], ([newKey]) => {
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
