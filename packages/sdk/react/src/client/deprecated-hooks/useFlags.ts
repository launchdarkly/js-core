'use client';

import { useContext, useEffect, useMemo, useState } from 'react';

import type { LDFlagSet } from '@launchdarkly/js-client-sdk';

import type { LDReactClient, LDReactClientContextValue } from '../LDClient';
import { LDReactContext } from '../provider/LDReactContext';
import { toCamelCase } from './flagKeyUtils';

function toFlagsProxy<T extends LDFlagSet>(client: LDReactClient, rawFlags: T): T {
  // Cache the results of the variation calls to avoid redundant calls.
  // Note that this function is memoized, so when the context changes, the
  // cache is recreated.

  // There is still an potential issue here if this function is used to only evaluate a
  // small subset of flags. In this case, any flag updates will cause a reset of the cache.
  const cache = new Map<string, unknown>();
  const useCamelCase = client.shouldUseCamelCaseFlagKeys();

  // Pre-build the display object, filtering out $ system keys.
  // Mirrors getCamelizedKeysAndFlagMap in the old react-client-sdk.
  const displayFlags: LDFlagSet = {};
  const flagKeyMap: Record<string, string> = {}; // camelKey -> originalKey

  Object.keys(rawFlags as LDFlagSet)
    .filter((rawKey) => rawKey.indexOf('$') !== 0) // exclude system keys (matches old SDK)
    .forEach((rawKey) => {
      if (useCamelCase) {
        const camelKey = toCamelCase(rawKey);
        displayFlags[camelKey] = (rawFlags as LDFlagSet)[rawKey];
        flagKeyMap[camelKey] = rawKey;
      } else {
        displayFlags[rawKey] = (rawFlags as LDFlagSet)[rawKey];
      }
    });

  // Only a get trap — matches old SDK's toFlagsProxy scope.
  return new Proxy(displayFlags as T, {
    get(target, prop, receiver) {
      const currentValue = Reflect.get(target, prop, receiver);

      // Only intercept own flag keys; pass through symbols and prototype methods.
      // Equivalent to old SDK: hasFlag(flagKeyMap, prop) || hasFlag(target, prop)
      if (typeof prop === 'symbol' || !Object.prototype.hasOwnProperty.call(target, prop)) {
        return currentValue;
      }

      if (currentValue === undefined) {
        return undefined;
      }

      if (cache.has(prop as string)) {
        return cache.get(prop as string);
      }

      const pristineKey = useCamelCase
        ? (flagKeyMap[prop as string] ?? (prop as string))
        : (prop as string);
      const result = client.variation(pristineKey, currentValue);
      cache.set(prop as string, result);
      return result;
    },
  });
}

/**
 * Returns all feature flags for the current context. Re-renders whenever any flag value changes.
 * Flag values are accessed via a proxy that triggers a `variation` call on each read, ensuring
 * evaluation events are sent to LaunchDarkly for accurate usage metrics.
 *
 * @remarks
 * When `useCamelCaseFlagKeys` is `true`, flag keys are converted to camelCase.
 * This means `"my-flag"` is accessible as `flags.myFlag`. Note that key collisions may occur
 * if two flag keys differ only in separators (e.g. `'my-flag'` and `'my.flag'` both map to
 * `'myFlag'` — last key wins), and Code References will not function correctly with camelCased keys.
 *
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns All current flag values, optionally with camelCased keys, wrapped in a proxy that
 *   records evaluations.
 *
 * @deprecated This hook is provided to ease migration from older versions of the React SDK.
 * For better performance, migrate to the typed variation hooks (`useBoolVariation`,
 * `useStringVariation`, `useNumberVariation`, `useJsonVariation`) or use `useLDClient`
 * with the client's `allFlags` method directly. This hook will be removed in a future major version.
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
    setFlags(client.allFlags() as T);
    const handler = () => setFlags(client.allFlags() as T);
    client.on('change', handler);
    return () => client.off('change', handler);
  }, [client, context]);

  // Context is included so the proxy is recreated on every identity change,
  // ensuring variations are re-called for the new LaunchDarkly context.
  return useMemo(() => toFlagsProxy(client, flags), [client, flags, context]) as T;
}
