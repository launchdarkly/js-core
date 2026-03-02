import React, { useEffect, useState } from 'react';

import type { LDReactClient, LDReactClientContextValue } from '../LDClient';
import { LDReactContext } from './LDReactContext';

/**
 * Creates a new LaunchDarkly React provider.
 *
 * @example
 * ```tsx
 * import { createLDReactProvider, initLDReactContext } from '@launchdarkly/react-sdk/client';
 * import { createClient } from '@launchdarkly/react-sdk';
 *
 *
 * const ReactContext = initLDReactContext();
 * const client = createClient(clientSideID, context);
 * const LDReactProvider = createLDReactProvider(client, ReactContext);
 * ```
 *
 * With the above code, you can now use reference the the LDCLient using
 * `useContext(ReactContext)`.
 *
 * @param client launchdarkly client instance @see {@link createClient}
 * @param ReactContext optional launchdarkly react context @see {@link initLDReactContext}
 * @returns {React.FC<{ children: React.ReactNode }>} The LaunchDarkly React Client provider.
 */
export function createLDReactProvider(
  client: LDReactClient,
  ReactContext?: React.Context<LDReactClientContextValue>,
): React.FC<{ children: React.ReactNode }> {
  const ContextProvider = ReactContext?.Provider ?? LDReactContext.Provider;

  const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<LDReactClientContextValue>({
      client,
      context: client.getContext() ?? undefined,
      initializedState: client.getInitializationState(),
    });

    useEffect(() => {
      let mounted = true;

      // TODO: support a 'deferred start' option so consumers can opt out of auto-start
      client.start().then((result) => {
        if (mounted) {
          setState((prev) => ({
            ...prev,
            initializedState: result.status,
            context: client.getContext() ?? undefined,
          }));
        }
      });

      // TODO: we haven't completed this implementation yet so we do expect a couple more
      // initial state updates that will propagate from the react context. This should be
      // better once we handle the initialization state changes. When that happens, users
      // can hold off their rendering until the client is in a stable intialized state.
      const unsubscribeContextChange = client.onContextChange((newContext) => {
        if (mounted) {
          setState((prev) => ({
            ...prev,
            context: newContext,
          }));
        }
      });

      return () => {
        mounted = false;
        unsubscribeContextChange();
      };
    }, []);

    return <ContextProvider value={state}>{children}</ContextProvider>;
  };

  return Provider;
}
