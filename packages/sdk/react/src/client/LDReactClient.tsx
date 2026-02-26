import {
  createClient as createBaseClient,
  LDContext,
  LDContextStrict,
  type LDEvaluationDetailTyped,
  LDEvaluationReason,
  type LDFlagValue,
  LDStartOptions,
} from '@launchdarkly/js-client-sdk';

import { InitializedState, LDReactClient } from './LDClient';
import { LDReactClientOptions } from './LDOptions';

function isServerSide() {
  return typeof window === 'undefined';
}

function noopDetail<T>(defaultValue: T): { value: T; kind: LDEvaluationReason['kind'] } {
  return { value: defaultValue, kind: 'NO Evaluation Reason' };
}

/**
 * Returns a noop LDReactClient for use on the server. Never instantiates the browser SDK.
 * This is useful when dealing with applications that are using React Server Components.
 *
 * This fallback is helpful when compilers attempt to prerender components on build time.
 * This will enable the components to at least be prerendered with their default values.
 *
 * @privateRemarks TODO
 * I think we should move this and the server noop to a shared location... currently we
 * are separating everything to trivialize network boundary and tree shaking concerns.
 * But we shouldn't have any problems having some shared modules.
 */
function createNoopReactClient(): LDReactClient {
  return {
    allFlags: () => ({}),
    boolVariation: (_key: string, defaultValue: boolean) => defaultValue,
    boolVariationDetail: (key: string, defaultValue: boolean) =>
      noopDetail(defaultValue) as LDEvaluationDetailTyped<boolean>,
    close: () => Promise.resolve(),
    flush: () => Promise.resolve({ result: true }),
    getContext: () => undefined,
    getInitializationState: (): InitializedState => 'unknown',
    identify: () => Promise.resolve({ status: 'completed' as const }),
    jsonVariation: (_key: string, defaultValue: unknown) => defaultValue,
    jsonVariationDetail: (key: string, defaultValue: unknown) =>
      noopDetail(defaultValue) as LDEvaluationDetailTyped<unknown>,
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    numberVariation: (_key: string, defaultValue: number) => defaultValue,
    numberVariationDetail: (key: string, defaultValue: number) =>
      noopDetail(defaultValue) as LDEvaluationDetailTyped<number>,
    off: () => {},
    on: () => {},
    onContextChange: () => () => {},
    setStreaming: () => {},
    start: () =>
      Promise.resolve({
        status: 'failed' as const,
        error: new Error('Server-side client cannot be used to start'),
      }),
    stringVariation: (_key: string, defaultValue: string) => defaultValue,
    stringVariationDetail: (key: string, defaultValue: string) =>
      noopDetail(defaultValue) as LDEvaluationDetailTyped<string>,
    track: () => {},
    variation: (_key: string, defaultValue?: LDFlagValue) => defaultValue ?? null,
    variationDetail: (key: string, defaultValue?: LDFlagValue) => {
      const def = defaultValue ?? null;
      return noopDetail(def) as LDEvaluationDetailTyped<LDFlagValue>;
    },
    waitForInitialization: () =>
      Promise.resolve({
        status: 'failed' as const,
        error: new Error('Server-side client cannot be used to wait for initialization'),
      }),
    addHook: () => {},
  };
}

/**
 * Creates a new instance of the LaunchDarkly client for React.
 *
 * @remarks
 * When called on the server, returns a noop client that never instantiates the browser SDK.
 * This function is exported so that developers can have more flexibility in client creation.
 * More so this is to preserve previous behavior of app developers managing their own client
 * instance.
 *
 * we DO NOT recommend using this client creation method.
 *
 * @example
 * ```tsx
 * import { createClient } from '@launchdarkly/react';
 * const client = createClient(clientSideID, context, options);
 * ```
 *
 * @param clientSideID launchdarkly client side id @see https://launchdarkly.com/docs/sdk/concepts/client-side-server-side#client-side-id
 * @param context launchdarkly context @see https://launchdarkly.com/docs/sdk/concepts/context
 * @param options
 * @returns
 */
export function createClient(
  clientSideID: string,
  context: LDContext,
  options?: LDReactClientOptions,
): LDReactClient {
  if (isServerSide()) {
    return createNoopReactClient();
  }

  const baseClient = createBaseClient(clientSideID, context, options);
  let initializationState: InitializedState = 'unknown';
  const subscribers = new Set<(context: LDContextStrict) => void>();

  return {
    ...baseClient,
    start: (startOptions?: LDStartOptions) => {
      initializationState = 'initializing';
      return baseClient.start(startOptions).then((result) => {
        initializationState = result.status;
        return result;
      });
    },
    identify: (...args) =>
      baseClient.identify(...args).then((result) => {
        const newContext = baseClient.getContext();
        if (newContext) {
          subscribers.forEach((cb) => cb(newContext));
        }
        return result;
      }),
    getInitializationState: () => initializationState,
    onContextChange: (callback: (context: LDContextStrict) => void) => {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
  };
}
