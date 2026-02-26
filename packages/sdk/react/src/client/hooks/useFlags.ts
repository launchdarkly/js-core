'use client';

import { useContext, useEffect, useState } from 'react';

import type { LDFlagSet } from '@launchdarkly/js-client-sdk';

import type { LDReactClientContextValue } from '../LDClient';
import { LDReactContext } from '../provider/LDReactContext';

/**
 * Returns all feature flags for the current context. Re-renders whenever any flag value changes.
 *
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns All current flag values as `T`.
 */
export function useFlags<T extends LDFlagSet = LDFlagSet>(
  reactContext?: React.Context<LDReactClientContextValue>,
): T {
  const { client } = useContext(reactContext ?? LDReactContext);
  const [flags, setFlags] = useState<T>(() => client.allFlags() as T);

  useEffect(() => {
    const handler = () => setFlags(client.allFlags() as T);
    client.on('change', handler);
    return () => client.off('change', handler);
  }, [client]);

  return flags;
}
