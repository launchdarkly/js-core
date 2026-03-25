'use client';

import { useContext } from 'react';

import type { InitializationStatus, LDReactClientContextValue } from '../LDClient';
import { LDReactContext } from '../provider/LDReactContext';

/**
 * Returns the initialization status of the LaunchDarkly client.
 *
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns An {@link InitializationStatus} object with the current state (and error, if failed).
 */
export function useInitializationStatus(
  reactContext?: React.Context<LDReactClientContextValue>,
): InitializationStatus {
  const { initializedState, error } = useContext(reactContext ?? LDReactContext);
  if (initializedState === 'failed') {
    return { status: 'failed', error: error! };
  }
  return { status: initializedState };
}
