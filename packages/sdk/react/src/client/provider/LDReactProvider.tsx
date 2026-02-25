import React from 'react';

import { LDReactClient, LDReactClientContextValue } from '../LDClient';

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
 * `useContect(ReactContext)`.
 *
 * @remarks
 * We do not keep a global client context reference in order to support being able
 * to have multiple clients in the same application. This means all hooks that we
 * provide will need to be scoped to the context itself.
 *
 * @privateRemarks TODO
 * Currently the implementation is in this form for simplicity. I think we will actually
 * make this a React function component once we add lifecycle management to the context.
 *
 * @param client launchdarkly client instance @see {@link createClient}
 * @param ReactContext launchdarkly react context @see {@link initLDReactContext}
 * @returns {React.FC<{ children: React.ReactNode }>} The LaunchDarkly React Client provider.
 */
export function createLDReactProvider(
  client: LDReactClient,
  ReactContext: React.Context<LDReactClientContextValue>,
): React.FC<{ children: React.ReactNode }> {
  const contextValue: LDReactClientContextValue = {
    client,
    intializedState: 'unknown',
  };

  const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ReactContext.Provider value={contextValue}>{children}</ReactContext.Provider>
  );

  return Provider;
}
