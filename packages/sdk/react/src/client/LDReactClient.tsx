import {
  createClient as createBaseClient,
  LDContext,
  LDContextStrict,
  LDStartOptions,
  LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk';

import { InitializedState, LDReactClient } from './LDClient';
import { LDReactClientOptions } from './LDOptions';

/**
 * Creates a new instance of the LaunchDarkly client for React.
 *
 * @remarks
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
  };
}
