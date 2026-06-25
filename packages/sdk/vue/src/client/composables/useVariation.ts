import type { MaybeRefOrGetter, InjectionKey, Ref } from 'vue';

import type { LDVueInstance } from '../LDClient';
import { useVariationCore } from './useVariationCore';

/**
 * Reactively evaluates a boolean feature flag.
 *
 * @param key the feature flag key (plain, ref, or getter)
 * @param defaultValue value returned while the flag loads or if it cannot be evaluated as a boolean
 * @param injectionKey optional injection key for multiple environments @see {@link createLDVueInstanceKey}
 */
export function useBoolVariation(
  key: MaybeRefOrGetter<string>,
  defaultValue: boolean,
  injectionKey?: InjectionKey<LDVueInstance>,
): Readonly<Ref<boolean>> {
  return useVariationCore(
    key,
    defaultValue,
    (client, k, def) => client.boolVariation(k, def),
    injectionKey,
  );
}

/**
 * Reactively evaluates a string feature flag.
 *
 * @param key the feature flag key (plain, ref, or getter)
 * @param defaultValue value returned while the flag loads or if it cannot be evaluated as a string
 * @param injectionKey optional injection key for multiple environments @see {@link createLDVueInstanceKey}
 */
export function useStringVariation(
  key: MaybeRefOrGetter<string>,
  defaultValue: string,
  injectionKey?: InjectionKey<LDVueInstance>,
): Readonly<Ref<string>> {
  return useVariationCore(
    key,
    defaultValue,
    (client, k, def) => client.stringVariation(k, def),
    injectionKey,
  );
}

/**
 * Reactively evaluates a numeric feature flag.
 *
 * @param key the feature flag key (plain, ref, or getter)
 * @param defaultValue value returned while the flag loads or if it cannot be evaluated as a number
 * @param injectionKey optional injection key for multiple environments @see {@link createLDVueInstanceKey}
 */
export function useNumberVariation(
  key: MaybeRefOrGetter<string>,
  defaultValue: number,
  injectionKey?: InjectionKey<LDVueInstance>,
): Readonly<Ref<number>> {
  return useVariationCore(
    key,
    defaultValue,
    (client, k, def) => client.numberVariation(k, def),
    injectionKey,
  );
}

/**
 * Reactively evaluates a JSON feature flag.
 *
 * @param key the feature flag key (plain, ref, or getter)
 * @param defaultValue value returned while the flag loads or if it cannot be evaluated
 * @param injectionKey optional injection key for multiple environments @see {@link createLDVueInstanceKey}
 */
export function useJsonVariation<T = unknown>(
  key: MaybeRefOrGetter<string>,
  defaultValue: T,
  injectionKey?: InjectionKey<LDVueInstance>,
): Readonly<Ref<T>> {
  return useVariationCore(
    key,
    defaultValue,
    (client, k, def) => client.jsonVariation(k, def) as T,
    injectionKey,
  );
}
