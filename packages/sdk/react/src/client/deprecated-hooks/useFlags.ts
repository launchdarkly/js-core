'use client';

import { useContext, useEffect, useMemo, useState } from 'react';

import type { LDFlagSet } from '@launchdarkly/js-client-sdk';

import type { LDReactClient, LDReactClientContextValue } from '../LDClient';
import { LDReactContext } from '../provider/LDReactContext';

function toFlagsProxy<T extends LDFlagSet>(client: LDReactClient, flags: T): T {
  // Cache the results of the variation calls to avoid redundant calls.
  // Note that this function is memoized, so when the context changes, the
  // cache is recreated.

  // There is still an potential issue here if this function is used to only evaluate a
  // small subset of flags. In this case, any flag updates will cause a reset of the cache.
  // It is recommended to use the useFlags hook instead.
  const cache = new Map<string, unknown>();

  return new Proxy(flags, {
    get(target, prop, receiver) {
      const currentValue = Reflect.get(target, prop, receiver);

      // Pass through symbols and non-flag keys (e.g. Object prototype methods)
      if (typeof prop === 'symbol' || !Object.prototype.hasOwnProperty.call(target, prop)) {
        return currentValue;
      }

      if (currentValue === undefined) {
        return undefined;
      }

      if (cache.has(prop)) {
        return cache.get(prop);
      }

      // Trigger a variation call so LaunchDarkly records an evaluation event
      const result = client.variation(prop as string, currentValue);
      cache.set(prop, result);
      return result;
    },
  });
}

/**
 * Returns all feature flags for the current context. Re-renders whenever any flag value changes.
 * Flag values are accessed via a proxy that triggers a `variation` call on each read, ensuring
 * evaluation events are sent to LaunchDarkly for accurate usage metrics.
 *
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns All current flag values as `T`, wrapped in a proxy that records evaluations.
 *
 * @deprecated Use `useLDClient` with the client's variation methods directly. This hook will be
 * removed in a future major version.
 */
export function useFlags<T extends LDFlagSet = LDFlagSet>(
  reactContext?: React.Context<LDReactClientContextValue>,
): T {
  const { client, context } = useContext(reactContext ?? LDReactContext);

  useEffect(() => {
    client.logger.warn(
      '[LaunchDarkly] useFlags is deprecated and will be removed in a future major version.',
    );
  }, []);

  const [flags, setFlags] = useState<T>(() => client.allFlags() as T);

  useEffect(() => {
    const handler = () => setFlags(client.allFlags() as T);
    client.on('change', handler);
    return () => client.off('change', handler);
  }, [client]);

  // context is included so the proxy (and its cache) is recreated on every identity
  // change, ensuring variation is re-called for the new LaunchDarkly context.
  return useMemo(() => toFlagsProxy(client, flags), [client, flags, context]) as T;
}
