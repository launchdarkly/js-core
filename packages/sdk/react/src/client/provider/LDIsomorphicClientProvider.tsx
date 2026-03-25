'use client';

import React, { useRef } from 'react';

import { LDContext } from '@launchdarkly/js-client-sdk';

import { createNoopClient } from '../createNoopClient';
import { LDReactProviderOptions } from '../LDOptions';
import { createLDReactProvider, createLDReactProviderWithClient } from './LDReactProvider';

/**
 * Props for {@link LDIsomorphicClientProvider}.
 */
export interface LDIsomorphicClientProviderProps {
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
   * Additional options forwarded to {@link createLDReactProvider}.
   *
   * The `bootstrap` field within these options will be overridden by the top-level
   * `bootstrap` prop (which contains server-evaluated data).
   */
  options?: Omit<LDReactProviderOptions, 'bootstrap'>;

  /**
   * Child components.
   */
  children: React.ReactNode;
}

/**
 * A `'use client'` provider that initializes the LaunchDarkly browser client from
 * server-evaluated flag values bootstrapped by {@link LDIsomorphicProvider}.
 *
 * @remarks
 * **NOTE:** This provider is designed to be used in conjunction with {@link LDIsomorphicProvider}
 * in a server component to compute the bootstrap data and render this provider automatically.
 */
export function LDIsomorphicClientProvider({
  clientSideId,
  context,
  bootstrap,
  options,
  children,
}: LDIsomorphicClientProviderProps) {
  const providerRef = useRef<React.FC<{ children: React.ReactNode }> | null>(null);

  if (providerRef.current === null) {
    if (typeof window === 'undefined') {
      providerRef.current = createLDReactProviderWithClient(createNoopClient(bootstrap as object));
    } else {
      providerRef.current = createLDReactProvider(clientSideId, context, { ...options, bootstrap });
    }
  }

  const LDProvider = providerRef.current;
  return <LDProvider>{children}</LDProvider>;
}
