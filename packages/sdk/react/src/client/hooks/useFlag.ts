'use client';

import { useContext, useEffect, useRef, useState } from 'react';

import type { LDReactClient, LDReactClientContextValue } from '../LDClient';
import { LDReactContext } from '../provider/LDReactContext';

/**
 * The set of types that can be used as a feature flag value with `useFlag` and `useFlagDetail`.
 */
export type LDFlagType = boolean | string | number | object;

function getVariation<T extends LDFlagType>(
  client: LDReactClient,
  key: string,
  defaultValue: T,
): T {
  if (typeof defaultValue === 'boolean') return client.boolVariation(key, defaultValue) as T;
  if (typeof defaultValue === 'string') return client.stringVariation(key, defaultValue) as T;
  if (typeof defaultValue === 'number') return client.numberVariation(key, defaultValue) as T;
  return client.jsonVariation(key, defaultValue) as T;
}

/**
 * Returns the value of a single feature flag, re-rendering only when that specific flag changes.
 *
 * @param key The feature flag key.
 * @param defaultValue The value to return if the flag is not available.
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The typed flag value, or `defaultValue` if the flag is unavailable.
 */
export function useFlag<T extends LDFlagType>(
  key: string,
  defaultValue: T,
  reactContext?: React.Context<LDReactClientContextValue>,
): T {
  const { client, context } = useContext(reactContext ?? LDReactContext);
  // Using a ref here to capture the latest defaultValue without
  // making it a depencency of the effect.
  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;
  const [value, setValue] = useState<T>(() => getVariation(client, key, defaultValue));

  useEffect(() => {
    // Captures the initial value if the flag key changes for this hook.
    // This state change should be batched with the initial default state
    // setting when the hooks is mounted.
    setValue(getVariation(client, key, defaultValueRef.current));
    const handler = () => setValue(getVariation(client, key, defaultValueRef.current));
    client.on(`change:${key}`, handler);
    return () => client.off(`change:${key}`, handler);
  }, [client, key, context]);

  return value;
}
