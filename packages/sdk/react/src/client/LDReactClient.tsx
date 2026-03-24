import {
  createClient as createBaseClient,
  LDContext,
  LDContextStrict,
  LDIdentifyOptions,
  LDIdentifyResult,
  LDOptions,
  LDStartOptions,
  LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk';

import { createNoopClient } from './createNoopClient';
import { InitializedState, LDReactClient } from './LDClient';
import { LDReactClientOptions } from './LDOptions';

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
  options: LDReactClientOptions = {},
): LDReactClient {
<<<<<<< HEAD
  // This should not happen during runtime, but some frameworks such as Next.js supports
  // static rendering which will attempt to render client code during build time. In these cases,
  // we will need to use the noop client to avoid errors.
=======
>>>>>>> c5eda353d (feat: adding isomorphic provider to bridge client and server)
  if (typeof window === 'undefined') {
    return createNoopClient();
  }

  const { useCamelCaseFlagKeys: shouldUseCamelCaseFlagKeys = true, ...ldOptions } = options;

  const baseClientOptions: LDOptions = {
    ...ldOptions,
    wrapperName: ldOptions?.wrapperName ?? 'react-client-sdk',
    wrapperVersion: ldOptions?.wrapperVersion ?? '0.0.0', // x-release-please-version
  };

  const baseClient = createBaseClient(clientSideID, context, baseClientOptions);
  let initializationState: InitializedState = 'initializing';
  let hasBootstrap = false;
  let startCalled = false;
  let startNotified = false;
  const subscribers = new Set<(context: LDContextStrict) => void>();
  const initStatusSubscribers = new Set<(result: LDWaitForInitializationResult) => void>();
  let lastInitResult: LDWaitForInitializationResult | undefined;

  function notifyContextSubscribers() {
    const newContext = baseClient.getContext();
    if (newContext) {
      subscribers.forEach((cb) => cb(newContext));
    }
  }

  return {
    ...baseClient,
    start: (startOptions?: LDStartOptions) => {
      // The base client start method is idempotent, so we can just return
      // the result if it has already been called.
      if (startCalled) {
        return baseClient.start(startOptions);
      }
      initializationState = 'initializing';
      startCalled = true;
      if (startOptions?.bootstrap) {
        hasBootstrap = true;
      }
      return baseClient.start(startOptions).then((result: LDWaitForInitializationResult) => {
        initializationState = result.status;
        lastInitResult = result;
        if (!startNotified) {
          startNotified = true;
          notifyContextSubscribers();
        }
        initStatusSubscribers.forEach((cb) => cb(result));
        return result;
      });
    },
    identify: (ldContext: LDContext, identifyOptions?: LDIdentifyOptions) =>
      baseClient.identify(ldContext, identifyOptions).then((result: LDIdentifyResult) => {
        if (result.status === 'completed') {
          notifyContextSubscribers();
        }
        return result;
      }),
    getInitializationState: () => initializationState,
    getInitializationError: () =>
      lastInitResult?.status === 'failed' ? lastInitResult.error : undefined,
    onContextChange: (callback: (ldContext: LDContextStrict) => void) => {
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
    isReady: () => initializationState !== 'initializing' || hasBootstrap,
    shouldUseCamelCaseFlagKeys: () => shouldUseCamelCaseFlagKeys,
  };
}
