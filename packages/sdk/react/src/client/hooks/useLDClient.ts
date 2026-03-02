'use client';

import { useContext } from 'react';

import type { LDReactClient, LDReactClientContextValue } from '../LDClient';
import { LDReactContext } from '../provider/LDReactContext';

/**
 * Returns the LaunchDarkly client instance from the nearest provider.
 *
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns The {@link LDReactClient} instance.
 */
export function useLDClient(
  reactContext?: React.Context<LDReactClientContextValue>,
): LDReactClient {
  const { client } = useContext(reactContext ?? LDReactContext);
  return client;
}
