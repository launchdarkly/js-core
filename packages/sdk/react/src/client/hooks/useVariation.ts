'use client';

import { useContext, useEffect, useRef, useState } from 'react';

import type { LDReactClient, LDReactClientContextValue } from '../LDClient';
import { LDReactContext } from '../provider/LDReactContext';

export function useVariationCore<T, R = T>(
  key: string,
  defaultValue: T,
  evaluate: (client: LDReactClient, key: string, defaultValue: T) => R,
  reactContext?: React.Context<LDReactClientContextValue>,
): R {
  const { client, context } = useContext(reactContext ?? LDReactContext);

  // Using refs here to capture the latest defaultValue and evaluate function
  // without making them dependencies of the effect.
  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;
  const evaluateRef = useRef(evaluate);
  evaluateRef.current = evaluate;

  const [value, setValue] = useState<R>(() => evaluate(client, key, defaultValue));

  useEffect(() => {
    // Captures the initial value if the flag key or context changes.
    setValue(evaluateRef.current(client, key, defaultValueRef.current));
    const handler = () => setValue(evaluateRef.current(client, key, defaultValueRef.current));
    client.on(`change:${key}`, handler);
    return () => client.off(`change:${key}`, handler);
  }, [client, key, context]);

  return value;
}

/**
 * Returns the boolean variation of a feature flag, re-rendering only when that specific flag changes.
 *
 * @param key The feature flag key.
 * @param defaultValue The value to return if the flag is not available.
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The boolean flag value, or `defaultValue` if the flag is unavailable.
 */
export function useBoolVariation(
  key: string,
  defaultValue: boolean,
  reactContext?: React.Context<LDReactClientContextValue>,
): boolean {
  return useVariationCore(
    key,
    defaultValue,
    (client, k, def) => client.boolVariation(k, def),
    reactContext,
  );
}

/**
 * Returns the string variation of a feature flag, re-rendering only when that specific flag changes.
 *
 * @param key The feature flag key.
 * @param defaultValue The value to return if the flag is not available.
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The string flag value, or `defaultValue` if the flag is unavailable.
 */
export function useStringVariation(
  key: string,
  defaultValue: string,
  reactContext?: React.Context<LDReactClientContextValue>,
): string {
  return useVariationCore(
    key,
    defaultValue,
    (client, k, def) => client.stringVariation(k, def),
    reactContext,
  );
}

/**
 * Returns the numeric variation of a feature flag, re-rendering only when that specific flag changes.
 *
 * @param key The feature flag key.
 * @param defaultValue The value to return if the flag is not available.
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The number flag value, or `defaultValue` if the flag is unavailable.
 */
export function useNumberVariation(
  key: string,
  defaultValue: number,
  reactContext?: React.Context<LDReactClientContextValue>,
): number {
  return useVariationCore(
    key,
    defaultValue,
    (client, k, def) => client.numberVariation(k, def),
    reactContext,
  );
}

/**
 * Returns the JSON variation of a feature flag, re-rendering only when that specific flag changes.
 *
 * @param key The feature flag key.
 * @param defaultValue The value to return if the flag is not available.
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The JSON flag value, or `defaultValue` if the flag is unavailable.
 */
export function useJsonVariation<T = unknown>(
  key: string,
  defaultValue: T,
  reactContext?: React.Context<LDReactClientContextValue>,
): T {
  return useVariationCore(
    key,
    defaultValue,
    (client, k, def) => client.jsonVariation(k, def) as T,
    reactContext,
  );
}
