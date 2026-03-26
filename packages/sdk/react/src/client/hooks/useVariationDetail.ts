'use client';

import type { LDEvaluationDetailTyped } from '@launchdarkly/js-client-sdk';

import type { LDReactClientContextValue } from '../LDClient';
import useVariationCore from './useVariationCore';

/**
 * Returns an evaluation detail with the default value and a reason of CLIENT_NOT_READY.
 *
 * @remarks
 * This aligns with the flag evaluation error kind that is defined in the base
 * `@launchdarkly/js-sdk-common` package.
 *
 * @param def default value to return if the flag is not available.
 * @returns an evaluation detail with the default value and a reason of CLIENT_NOT_READY.
 */
function notReadyDetail<T>(def: T): LDEvaluationDetailTyped<T> {
  return {
    value: def,
    variationIndex: null,
    reason: { kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' },
  };
}

/**
 * Returns the boolean variation and evaluation detail of a feature flag.
 *
 * @param key The feature flag key.
 * @param defaultValue The value to return if the flag is not available.
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The evaluation detail including `value`, `variationIndex`, and `reason`.
 */
export function useBoolVariationDetail(
  key: string,
  defaultValue: boolean,
  reactContext?: React.Context<LDReactClientContextValue>,
): LDEvaluationDetailTyped<boolean> {
  return useVariationCore<boolean, LDEvaluationDetailTyped<boolean>>(
    key,
    defaultValue,
    (client, k, def) => client.boolVariationDetail(k, def),
    reactContext,
    notReadyDetail,
  );
}

/**
 * Returns the string variation and evaluation detail of a feature flag.
 *
 * @param key The feature flag key.
 * @param defaultValue The value to return if the flag is not available.
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The evaluation detail including `value`, `variationIndex`, and `reason`.
 */
export function useStringVariationDetail(
  key: string,
  defaultValue: string,
  reactContext?: React.Context<LDReactClientContextValue>,
): LDEvaluationDetailTyped<string> {
  return useVariationCore<string, LDEvaluationDetailTyped<string>>(
    key,
    defaultValue,
    (client, k, def) => client.stringVariationDetail(k, def),
    reactContext,
    notReadyDetail,
  );
}

/**
 * Returns the numeric variation and evaluation detail of a feature flag.
 *
 * @param key The feature flag key.
 * @param defaultValue The value to return if the flag is not available.
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The evaluation detail including `value`, `variationIndex`, and `reason`.
 */
export function useNumberVariationDetail(
  key: string,
  defaultValue: number,
  reactContext?: React.Context<LDReactClientContextValue>,
): LDEvaluationDetailTyped<number> {
  return useVariationCore<number, LDEvaluationDetailTyped<number>>(
    key,
    defaultValue,
    (client, k, def) => client.numberVariationDetail(k, def),
    reactContext,
    notReadyDetail,
  );
}

/**
 * Returns the JSON variation and evaluation detail of a feature flag.
 *
 * @param key The feature flag key.
 * @param defaultValue The value to return if the flag is not available.
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The evaluation detail including `value`, `variationIndex`, and `reason`.
 */
export function useJsonVariationDetail<T = unknown>(
  key: string,
  defaultValue: T,
  reactContext?: React.Context<LDReactClientContextValue>,
): LDEvaluationDetailTyped<T> {
  return useVariationCore<T, LDEvaluationDetailTyped<T>>(
    key,
    defaultValue,
    (client, k, def) => client.jsonVariationDetail(k, def) as LDEvaluationDetailTyped<T>,
    reactContext,
    notReadyDetail,
  );
}
