import React, { useEffect, useState } from 'react';

import { LDContext } from '@launchdarkly/js-client-sdk';

import type { LDReactClient, LDReactClientContextValue } from '../LDClient';
import { LDReactProviderOptions } from '../LDOptions';
import { createClient } from '../LDReactClient';
import { LDReactContext } from './LDReactContext';

/**
 * Creates a new LaunchDarkly React provider wrapping an existing client instance.
 *
 * The caller is responsible for calling `client.start()` before or after mounting —
 * this function does not auto-start the client. The provider subscribes to
 * `onInitializationStatusChange()` and `onContextChange()` to update React state.
 *
 * @example
 * ```tsx
 * import { createClient, createLDReactProviderWithClient, initLDReactContext } from '@launchdarkly/react-sdk';
 *
 * const client = createClient(clientSideID, context);
 * client.start();
 * const LDProvider = createLDReactProviderWithClient(client);
 * ```
 *
 * For multiple client instances, pass a custom React context:
 * ```tsx
 * const ReactContext = initLDReactContext();
 * const LDProvider = createLDReactProviderWithClient(client, ReactContext);
 * ```
 *
 * @param client launchdarkly client instance @see {@link createClient}
 * @param ReactContext optional launchdarkly react context @see {@link initLDReactContext}
 * @returns {React.FC<{ children: React.ReactNode }>} The LaunchDarkly React Client provider.
 */
export function createLDReactProviderWithClient(
  client: LDReactClient,
  ReactContext?: React.Context<LDReactClientContextValue>,
): React.FC<{ children: React.ReactNode }> {
  const ContextProvider = ReactContext?.Provider ?? LDReactContext.Provider;

  const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<LDReactClientContextValue>({
      client,
      context: client.getContext() ?? undefined,
      initializedState: client.getInitializationState(),
      error: client.getInitializationError(),
    });

    useEffect(() => {
      let mounted = true;

      const unsubscribeInitStatus = client.onInitializationStatusChange((result) => {
        if (mounted) {
          setState((prev) => {
            if (prev.initializedState === result.status) {
              return prev;
            }
            return {
              ...prev,
              initializedState: result.status,
              error: result.status === 'failed' ? result.error : undefined,
            };
          });
        }
      });

      const unsubscribeContextChange = client.onContextChange((newContext) => {
        if (mounted) {
          setState((prev) => ({ ...prev, context: newContext }));
        }
      });

      return () => {
        mounted = false;
        unsubscribeInitStatus();
        unsubscribeContextChange();
      };
    }, []);

    return <ContextProvider value={state}>{children}</ContextProvider>;
  };

  return Provider;
}

/**
 * Creates a new LaunchDarkly React provider, creating the client internally.
 *
 * By default the client is started immediately (before the provider mounts).
 * Pass `deferInitialization: true` in options to opt out of auto-start and call
 * `client.start()` yourself via `useLDClient()`.
 *
 * @example
 * ```tsx
 * import { createLDReactProvider } from '@launchdarkly/react-sdk';
 *
 * const LDProvider = createLDReactProvider('your-client-side-id', { kind: 'user', key: 'user-key' });
 *
 * function Root() {
 *   return (
 *     <LDProvider>
 *       <App />
 *     </LDProvider>
 *   );
 * }
 * ```
 *
 * @param clientSideID launchdarkly client-side ID
 * @param context the initial LaunchDarkly context
 * @param options optional provider and client options
 * @returns {React.FC<{ children: React.ReactNode }>} The LaunchDarkly React Client provider.
 */
export function createLDReactProvider(
  clientSideID: string,
  context: LDContext,
  options?: LDReactProviderOptions,
): React.FC<{ children: React.ReactNode }> {
  const { deferInitialization, startOptions, reactContext, ldOptions } = options ?? {};

  const client = createClient(clientSideID, context, ldOptions);

  if (!deferInitialization) {
    client.start(startOptions);
  }

  return createLDReactProviderWithClient(client, reactContext);
}
