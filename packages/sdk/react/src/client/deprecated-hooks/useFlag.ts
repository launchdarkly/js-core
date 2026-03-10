'use client';

import { useContext, useEffect } from 'react';

import useVariationCore from '../hooks/useVariationCore';
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
 *
 * @deprecated Use `useLDClient` with the client's variation methods directly. This hook will be
 * removed in a future major version.
 */
export function useFlag<T extends LDFlagType>(
  key: string,
  defaultValue: T,
  reactContext?: React.Context<LDReactClientContextValue>,
): T {
  const { client } = useContext(reactContext ?? LDReactContext);

  useEffect(() => {
    client.logger.warn(
      '[LaunchDarkly] useFlag is deprecated and will be removed in a future major version.',
    );
  }, []);

  return useVariationCore(key, defaultValue, getVariation, reactContext);
}
