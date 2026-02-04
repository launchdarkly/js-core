'use client';

import React, { useState } from 'react';

import { LDContext } from '@launchdarkly/js-client-sdk';

import { createClient } from '../LDReactClient';
import { createLDReactProviderWithClient } from './LDReactProvider';

/**
 * Props for {@link LDBootstrapClientProvider}.
 */
export interface LDBootstrapClientProviderProps {
  /**
   * The LaunchDarkly client-side ID.
   */
  clientSideId: string;

  /**
   * The initial context to identify with.
   */
  context: LDContext;

  /**
   * Bootstrap data from the server. Pass the result of `flagsState.toJSON()` obtained
   * from {@link LDServerSession.allFlagsState} on the server.
   *
   * When provided, the client immediately uses these values before the first network
   * response arrives — eliminating the flag-fetch waterfall on page load.
   */
  bootstrap: unknown;

  /**
   * Child components.
   */
  children: React.ReactNode;
}

/**
 * A `'use client'` provider that initialises the LaunchDarkly browser client from
 * server-evaluated flag values bootstrapped by {@link LDIsomorphicProvider}.
 *
 * @remarks
 * The client is created exactly once on mount (via `useState` initialiser). It starts
 * immediately with the supplied `bootstrap` data, so flag values are available
 * synchronously on the first render without waiting for a network round-trip.
 *
 * After the initial render, the client opens a streaming connection and live flag
 * changes propagate normally.
 *
 * Use {@link LDIsomorphicProvider} in a server component to compute the bootstrap
 * data and render this provider automatically.
 */
export function LDBootstrapClientProvider({
  clientSideId,
  context,
  bootstrap,
  children,
}: LDBootstrapClientProviderProps) {
  const [LDProvider] = useState(() => {
    const client = createClient(clientSideId, context);
    client.start({ bootstrap });
    return createLDReactProviderWithClient(client);
  });

  return <LDProvider>{children}</LDProvider>;
}
