import type { LDEvaluationDetailTyped } from '@launchdarkly/js-client-sdk';
import type { InjectionKey, MaybeRefOrGetter, Ref } from 'vue';

import type { LDVueInstance } from '../LDClient';
import { useVariationCore } from './useVariationCore';

/**
 * Returns an evaluation detail with the default value and a CLIENT_NOT_READY error reason, used
 * before the client is ready.
 */
function notReadyDetail<T>(def: T): LDEvaluationDetailTyped<T> {
  return {
    value: def,
    variationIndex: null,
    reason: { kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' },
  };
}

/**
 * Reactively evaluates a boolean feature flag and exposes the full evaluation detail (value,
 * variationIndex, reason). Reasons are populated only when `withReasons` is enabled.
 *
 * @param key the feature flag key (plain, ref, or getter)
 * @param defaultValue value returned while the flag loads or if it cannot be evaluated
 * @param injectionKey optional injection key for multiple environments @see {@link createLDVueInstanceKey}
 */
export function useBoolVariationDetail(
  key: MaybeRefOrGetter<string>,
  defaultValue: boolean,
  injectionKey?: InjectionKey<LDVueInstance>,
): Readonly<Ref<LDEvaluationDetailTyped<boolean>>> {
  return useVariationCore<boolean, LDEvaluationDetailTyped<boolean>>(
    key,
    defaultValue,
    (client, k, def) => client.boolVariationDetail(k, def),
    injectionKey,
    notReadyDetail,
  );
}

/**
 * Reactively evaluates a string feature flag and exposes the full evaluation detail.
 *
 * @param key the feature flag key (plain, ref, or getter)
 * @param defaultValue value returned while the flag loads or if it cannot be evaluated
 * @param injectionKey optional injection key for multiple environments @see {@link createLDVueInstanceKey}
 */
export function useStringVariationDetail(
  key: MaybeRefOrGetter<string>,
  defaultValue: string,
  injectionKey?: InjectionKey<LDVueInstance>,
): Readonly<Ref<LDEvaluationDetailTyped<string>>> {
  return useVariationCore<string, LDEvaluationDetailTyped<string>>(
    key,
    defaultValue,
    (client, k, def) => client.stringVariationDetail(k, def),
    injectionKey,
    notReadyDetail,
  );
}

/**
 * Reactively evaluates a numeric feature flag and exposes the full evaluation detail.
 *
 * @param key the feature flag key (plain, ref, or getter)
 * @param defaultValue value returned while the flag loads or if it cannot be evaluated
 * @param injectionKey optional injection key for multiple environments @see {@link createLDVueInstanceKey}
 */
export function useNumberVariationDetail(
  key: MaybeRefOrGetter<string>,
  defaultValue: number,
  injectionKey?: InjectionKey<LDVueInstance>,
): Readonly<Ref<LDEvaluationDetailTyped<number>>> {
  return useVariationCore<number, LDEvaluationDetailTyped<number>>(
    key,
    defaultValue,
    (client, k, def) => client.numberVariationDetail(k, def),
    injectionKey,
    notReadyDetail,
  );
}

/**
 * Reactively evaluates a JSON feature flag and exposes the full evaluation detail.
 *
 * @param key the feature flag key (plain, ref, or getter)
 * @param defaultValue value returned while the flag loads or if it cannot be evaluated
 * @param injectionKey optional injection key for multiple environments @see {@link createLDVueInstanceKey}
 */
export function useJsonVariationDetail<T = unknown>(
  key: MaybeRefOrGetter<string>,
  defaultValue: T,
  injectionKey?: InjectionKey<LDVueInstance>,
): Readonly<Ref<LDEvaluationDetailTyped<T>>> {
  return useVariationCore<T, LDEvaluationDetailTyped<T>>(
    key,
    defaultValue,
    (client, k, def) => client.jsonVariationDetail(k, def) as LDEvaluationDetailTyped<T>,
    injectionKey,
    notReadyDetail,
  );
}
