'use client';

import React, { useRef } from 'react';

import { LDContext } from '@launchdarkly/js-client-sdk';

import { createNoopClient } from '../createNoopClient';
import { LDReactClientContextValue } from '../LDClient';
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
   * @remarks
   * **NOTE:** This interface is meant to be used with the server component {@link LDIsomorphicProvider}.
   * If you are looking to providing your own bootstrap data, you should use
   * the {@link createLDReactProvider} function directly.
   *
   */
  bootstrap: unknown;

  /**
   * Additional options forwarded to {@link createLDReactProvider}.
   *
   * @remarks
   * The omitted fields are hoisted to top level options because they are not
   * serializable across the RSC boundary.
   */
  options?: Omit<LDReactProviderOptions, 'bootstrap' | 'reactContext'>;

  /**
   * Optional custom React context for the LaunchDarkly client. Use this when you need
   * multiple LaunchDarkly client instances in the same application.
   */
  reactContext?: React.Context<LDReactClientContextValue>;

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
  reactContext,
  children,
}: LDIsomorphicClientProviderProps) {
  const providerRef = useRef<React.FC<{ children: React.ReactNode }> | null>(null);

  if (providerRef.current === null) {
    if (typeof window === 'undefined') {
      providerRef.current = createLDReactProviderWithClient(
        createNoopClient(bootstrap as object),
        reactContext,
      );
    } else {
      providerRef.current = createLDReactProvider(clientSideId, context, {
        ...options,
        bootstrap,
        reactContext,
      });
    }
  }

  const LDProvider = providerRef.current;
  return <LDProvider>{children}</LDProvider>;
}
