'use client';

import { useContext, useEffect, useRef, useState } from 'react';

import type { LDEvaluationDetailTyped } from '@launchdarkly/js-client-sdk';

import type { LDReactClient, LDReactClientContextValue } from '../LDClient';
import { LDReactContext } from '../provider/LDReactContext';

function useVariationDetailCore<T>(
  key: string,
  defaultValue: T,
  evaluate: (client: LDReactClient, key: string, defaultValue: T) => LDEvaluationDetailTyped<T>,
  reactContext?: React.Context<LDReactClientContextValue>,
): LDEvaluationDetailTyped<T> {
  const { client, context } = useContext(reactContext ?? LDReactContext);

  // Using refs here to capture the latest defaultValue and evaluate function
  // without making them dependencies of the effect.
  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;
  const evaluateRef = useRef(evaluate);
  evaluateRef.current = evaluate;

  const [detail, setDetail] = useState<LDEvaluationDetailTyped<T>>(() =>
    evaluate(client, key, defaultValue),
  );

  useEffect(() => {
    // Captures the initial value if the flag key or context changes.
    setDetail(evaluateRef.current(client, key, defaultValueRef.current));
    const handler = () => setDetail(evaluateRef.current(client, key, defaultValueRef.current));
    client.on(`change:${key}`, handler);
    return () => client.off(`change:${key}`, handler);
  }, [client, key, context]);

  return detail;
}

/**
 * Returns the boolean variation and evaluation detail of a feature flag, re-rendering only when
 * that specific flag changes.
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
  return useVariationDetailCore(
    key,
    defaultValue,
    (client, k, def) => client.boolVariationDetail(k, def),
    reactContext,
  );
}

/**
 * Returns the string variation and evaluation detail of a feature flag, re-rendering only when
 * that specific flag changes.
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
  return useVariationDetailCore(
    key,
    defaultValue,
    (client, k, def) => client.stringVariationDetail(k, def),
    reactContext,
  );
}

/**
 * Returns the numeric variation and evaluation detail of a feature flag, re-rendering only when
 * that specific flag changes.
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
  return useVariationDetailCore(
    key,
    defaultValue,
    (client, k, def) => client.numberVariationDetail(k, def),
    reactContext,
  );
}

/**
 * Returns the JSON variation and evaluation detail of a feature flag, re-rendering only when
 * that specific flag changes.
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
  return useVariationDetailCore(
    key,
    defaultValue,
    (client, k, def) => client.jsonVariationDetail(k, def) as LDEvaluationDetailTyped<T>,
    reactContext,
  );
}
