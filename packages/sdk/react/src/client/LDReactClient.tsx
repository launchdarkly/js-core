import {
  createClient as createBaseClient,
  LDContext,
  LDContextStrict,
  type LDEvaluationDetailTyped,
  LDEvaluationReason,
  type LDFlagValue,
  LDStartOptions,
  LDWaitForInitializationResult,
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
 * @privateRemarks
 * **WARNING:** This function is going to be removed soon! sdk-2043
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
    getInitializationError: (): Error | undefined => undefined,
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
    onInitializationStatusChange: () => () => {},
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
    shouldUseCamelCaseFlagKeys: () => true,
  };
}

/**
 * Creates a new instance of the LaunchDarkly client for React.
 *
 * @remarks
 * **NOTE:** We recommend using the convenience factory function {@link createLDReactProvider}
 * instead of this function to create your client instance if you can.
 *
 * This factory function is provided to allow the caller to have more control over their client instance.
 * When using this function, the caller is responsible for:
 *  - calling `client.start()` before or after mounting.
 *  - subscribing to client lifecycle events.
 *
 * Refer to {@link createLDReactProviderWithClient} for the default behavior.
 *
 * @example
 * ```tsx
 * import { createClient } from '@launchdarkly/react';
 * const client = createClient(clientSideID, context, options);
 *
 * await client.start();
 * ```
 *
 * @param clientSideID launchdarkly client side id @see https://launchdarkly.com/docs/sdk/concepts/client-side-server-side#client-side-id
 * @param context launchdarkly context @see https://launchdarkly.com/docs/sdk/concepts/context
 * @param options options for the client @see {@link LDReactClientOptions}
 * @returns the new client instance @see {@link LDReactClient}
 */
export function createClient(
  clientSideID: string,
  context: LDContext,
  options?: LDReactClientOptions,
): LDReactClient {
  if (isServerSide()) {
    return createNoopReactClient();
  }
  const shouldUseCamelCaseFlagKeys = options?.useCamelCaseFlagKeys ?? true;

  const baseClient = createBaseClient(clientSideID, context, options);
  let initializationState: InitializedState = 'unknown';
  const subscribers = new Set<(context: LDContextStrict) => void>();
  const initStatusSubscribers = new Set<(result: LDWaitForInitializationResult) => void>();
  let lastInitResult: LDWaitForInitializationResult | undefined;

  return {
    ...baseClient,
    start: (startOptions?: LDStartOptions) => {
      // The base client start method is idempotent, so we can just return
      // the result if it has already been called.
      if (initializationState !== 'unknown') {
        return baseClient.start(startOptions);
      }
      initializationState = 'initializing';
      return baseClient.start(startOptions).then((result) => {
        initializationState = result.status;
        lastInitResult = result;
        initStatusSubscribers.forEach((cb) => cb(result));
        return result;
      });
    },
    identify: (...args) =>
      baseClient.identify(...args).then((result) => {
        if (result.status === 'completed') {
          const newContext = baseClient.getContext();
          if (newContext) {
            subscribers.forEach((cb) => cb(newContext));
          }
        }
        return result;
      }),
    getInitializationState: () => initializationState,
    getInitializationError: () =>
      lastInitResult?.status === 'failed' ? lastInitResult.error : undefined,
    onContextChange: (callback: (context: LDContextStrict) => void) => {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
    onInitializationStatusChange: (callback: (result: LDWaitForInitializationResult) => void) => {
      if (lastInitResult) {
        callback(lastInitResult);
      }
      initStatusSubscribers.add(callback);
      return () => {
        initStatusSubscribers.delete(callback);
      };
    },
    shouldUseCamelCaseFlagKeys: () => shouldUseCamelCaseFlagKeys,
  };
}
