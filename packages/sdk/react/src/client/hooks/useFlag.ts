'use client';

import { useContext, useEffect, useState } from 'react';

import type { LDFlagValue } from '@launchdarkly/js-client-sdk';

import type { LDReactClientContextValue } from '../LDClient';
import { LDReactContext } from '../provider/LDReactContext';

/**
 * Returns the value of a single feature flag, re-rendering only when that specific flag changes.
 *
 * // TODO: we need to define the valid types for the flag value
 *
 * @param key The feature flag key.
 * @param defaultValue The value to return if the flag is not available.
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The typed flag value, or `defaultValue` if the flag is unavailable.
 */
export function useFlag<T extends LDFlagValue>(
  key: string,
  defaultValue: T,
  reactContext?: React.Context<LDReactClientContextValue>,
): T {
  const { client } = useContext(reactContext ?? LDReactContext);
  const [value, setValue] = useState<T>(() => client.variation(key, defaultValue) as T);

  useEffect(() => {
    const handler = () => setValue(client.variation(key, defaultValue) as T);
    client.on(`change:${key}`, handler);
    return () => client.off(`change:${key}`, handler);
  }, [client, key, defaultValue]);

  return value;
}
