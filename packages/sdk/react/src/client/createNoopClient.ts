import type { LDReactClient } from './LDClient';

// NOTE: We intentionally do not check `$valid` here. During SSR, we serve bootstrap
// flags on a best-effort basis regardless of validity since there is no live connection
// to LaunchDarkly. The client-side SDK will re-evaluate once hydrated.
function extractFlags(bootstrap: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(bootstrap).filter(([key]) => !key.startsWith('$')));
}

/**
 * @internal
 *
 * Creates an {@link LDReactClient} stub that returns default values for all
 * variation calls. Intended for use during server-side rendering of `'use client'`
 * components where no real client is available.
 *
 * @remarks
 * Optionally accepts bootstrap data that will be applied to the client-side SDK.
 * Learn more about bootstrap data in the [LaunchDarkly documentation](https://launchdarkly.com/docs/sdk/features/bootstrapping).
 *
 * **NOTE:** The client will also ad-hoc evaluate the flags on the server-side from bootstrap data.
 * This could be useful to have pre-evaluated flags available before client-side hydration. It should
 * be noted that this "pre-evaluation" ONLY provides the value flag, if you need flag details, then
 * you will not get that until the client-side SDK is ready and did its own evaluation.
 *
 * @param bootstrap Optional bootstrap data object.
 * @returns An {@link LDReactClient} noop stub, optionally enriched with bootstrap data.
 */
export function createNoopClient(bootstrap?: object): LDReactClient {
  const flags = extractFlags(bootstrap ?? {});
  const hasBootstrap = bootstrap !== undefined;

  function getVariation<T>(key: string, defaultValue: T, typeCheck: (v: unknown) => v is T): T {
    if (key in flags && typeCheck(flags[key])) {
      return flags[key] as T;
    }
    return defaultValue;
  }

  function getJsonVariation(key: string, defaultValue: unknown): unknown {
    if (key in flags) {
      return flags[key];
    }
    return defaultValue;
  }

  function getDetail<T>(key: string, defaultValue: T, typeCheck?: (v: unknown) => v is T) {
    const value = typeCheck
      ? getVariation(key, defaultValue, typeCheck)
      : getJsonVariation(key, defaultValue);
    return {
      value,
      variationIndex: null,
      reason: null,
    };
  }

  const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
  const isNumber = (v: unknown): v is number => typeof v === 'number';
  const isString = (v: unknown): v is string => typeof v === 'string';

  const noop = () => {};
  const noopUnsub = () => noop;
  const noopPromise = () => Promise.resolve();

  return {
    allFlags: () => ({ ...flags }),
    getContext: () => undefined,
    getInitializationState: () => (hasBootstrap ? 'complete' : 'initializing'),
    getInitializationError: () => undefined,
    isReady: () => hasBootstrap,
    boolVariation: (key: string, def: boolean) => getVariation(key, def, isBoolean),
    numberVariation: (key: string, def: number) => getVariation(key, def, isNumber),
    stringVariation: (key: string, def: string) => getVariation(key, def, isString),
    jsonVariation: (key: string, def: unknown) => getJsonVariation(key, def),
    boolVariationDetail: (key: string, def: boolean) => getDetail(key, def, isBoolean),
    numberVariationDetail: (key: string, def: number) => getDetail(key, def, isNumber),
    stringVariationDetail: (key: string, def: string) => getDetail(key, def, isString),
    jsonVariationDetail: (key: string, def: unknown) => getDetail(key, def),
    variation: (key: string, def: unknown) => getJsonVariation(key, def),
    variationDetail: (key: string, def: unknown) => getDetail(key, def),

    // The following methods should not be accessible in the server runtime assuming
    // normal usage of this SDK. So we are more lax with their stubs.
    on: noop,
    off: noop,
    onContextChange: noopUnsub,
    onInitializationStatusChange: noopUnsub,
    shouldUseCamelCaseFlagKeys: () => true,
    close: noopPromise,
    flush: noopPromise,
    identify: noopPromise,
    track: noop,
    addHook: noop,
    waitForInitialization: noopPromise,
    setStreaming: noop,
    start: noopPromise,
    logger: { debug: noop, info: noop, warn: noop, error: noop },
  } as unknown as LDReactClient;
}
