'use client';

import React, { useRef } from 'react';

import { LDContext } from '@launchdarkly/js-client-sdk';

import type { LDReactClient } from '../LDClient';
import { createClient } from '../LDReactClient';
import { createLDReactProviderWithClient } from './LDReactProvider';

// Minimal stand-in used only during server-side rendering of this 'use client' component.
// Only covers methods that execute during SSR (useState initializers); useEffect callbacks
// never run server-side so on/off/onContextChange/onInitializationStatusChange are omitted.
const ssrDetail = (def: unknown) => ({
  value: def,
  variationIndex: null,
  reason: { kind: 'ERROR' as const, errorKind: 'CLIENT_NOT_READY' as const },
});

const SSR_NOOP = {
  allFlags: () => ({}),
  getContext: () => undefined,
  getInitializationState: () => 'unknown',
  getInitializationError: () => undefined,
  boolVariation: (_k: string, def: boolean) => def,
  numberVariation: (_k: string, def: number) => def,
  stringVariation: (_k: string, def: string) => def,
  jsonVariation: (_k: string, def: unknown) => def,
  boolVariationDetail: (_k: string, def: boolean) => ssrDetail(def),
  numberVariationDetail: (_k: string, def: number) => ssrDetail(def),
  stringVariationDetail: (_k: string, def: string) => ssrDetail(def),
  jsonVariationDetail: (_k: string, def: unknown) => ssrDetail(def),
} as unknown as LDReactClient;

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
 * The client is created exactly once on mount (via `useRef` guard). It starts
 * immediately with the supplied `bootstrap` data, so flag values are available
 * synchronously on the first render without waiting for a network round-trip.
 *
 * @privateRemarks
 * TODO: this is not completed yet as we will need think about whether it is
 * appropriate to have a separate client for the bootstrapped data vs bootstrapping
 * the data to a running client.
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
  const providerRef = useRef<React.FC<{ children: React.ReactNode }> | null>(null);

  if (providerRef.current === null) {
    if (typeof window === 'undefined') {
      providerRef.current = createLDReactProviderWithClient(SSR_NOOP);
    } else {
      const client = createClient(clientSideId, context);
      client.start({ bootstrap });
      providerRef.current = createLDReactProviderWithClient(client);
    }
  }

  const LDProvider = providerRef.current;
  return <LDProvider>{children}</LDProvider>;
}
