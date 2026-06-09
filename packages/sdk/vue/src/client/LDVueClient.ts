import {
  createClient as createBaseClient,
  type LDContext,
  type LDContextStrict,
  type LDIdentifyOptions,
  type LDIdentifyResult,
  type LDOptions,
  type LDStartOptions,
  type LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk';

import type { InitializedState, LDVueClient } from './LDClient';
import type { LDVueClientOptions } from './LDOptions';

/**
 * Creates a new instance of the LaunchDarkly client for Vue.
 *
 * @remarks
 * This factory is provided to allow the caller to own the client lifecycle. When using this
 * function, the caller is responsible for calling `client.start()` before or after mounting
 * and for subscribing to client lifecycle events.
 *
 * TODO(scaffold): add recommendation to prefer createLDProvider / LDVuePlugin once those
 * arrive in the next PR, and restore the createLDProviderWithClient cross-reference.
 *
 * @example
 * ```ts
 * import { createClient } from '@launchdarkly/vue-client-sdk';
 *
 * const client = createClient('your-client-side-id', { kind: 'user', key: 'user-key' });
 * await client.start();
 * ```
 *
 * @param clientSideID the LaunchDarkly client-side ID @see https://launchdarkly.com/docs/sdk/concepts/client-side-server-side#client-side-id
 * @param context the initial LaunchDarkly context @see https://launchdarkly.com/docs/sdk/concepts/context
 * @param options options for the client @see {@link LDVueClientOptions}
 * @returns the new client instance @see {@link LDVueClient}
 */
export function createClient(
  clientSideID: string,
  context: LDContext,
  options: LDVueClientOptions = {},
): LDVueClient {
  const baseClientOptions: LDOptions = {
    ...options,
    wrapperName: options.wrapperName ?? 'vue-client-sdk',
    wrapperVersion: options.wrapperVersion ?? '0.1.0', // x-release-please-version
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
      // The base client start method is idempotent, so just return its result if already called.
      if (startCalled) {
        return baseClient.start(startOptions);
      }
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
  };
}
