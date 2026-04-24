import React from 'react';

import type { LDReactProviderOptions } from '@launchdarkly/react-sdk';
import { LDIsomorphicClientProvider } from '@launchdarkly/react-sdk';

import { LDServerSession } from './LDClient';

/**
 * Props for {@link LDIsomorphicProvider}.
 */
export interface LDIsomorphicProviderProps {
  /**
   * A server session created by {@link createLDServerSession}. The session provides
   * the context and all-flags state used to bootstrap the client.
   */
  session: LDServerSession;

  /**
   * The LaunchDarkly client-side ID used to initialize the JavaScript Client SDK.
   */
  clientSideId: string;

  /**
   * Additional options forwarded to the underlying client provider and ultimately
   * to {@link createLDReactProvider}.
   *
   * @remarks
   * We omit the `bootstrap` and `reactContext` fields because they are not serializable
   * across the RSC boundary.
   */
  options?: Omit<LDReactProviderOptions, 'bootstrap' | 'reactContext'>;

  children: React.ReactNode;
}

/**
 * An async React Server Component that bootstraps the LaunchDarkly browser client with
 * server-evaluated flag values.
 *
 * @remarks
 * **NOTE:** This component is designed to be used in conjunction with {@link LDIsomorphicClientProvider}
 * in a server component to compute the bootstrap data and render this provider automatically.
 *
 * See the `react-server-example` example for how to use this component.
 */
export async function LDIsomorphicProvider({
  session,
  clientSideId,
  options,
  children,
}: LDIsomorphicProviderProps) {
  let bootstrap: unknown;
  try {
    const flagsState = await session.allFlagsState({ clientSideOnly: true });
    bootstrap = flagsState.toJSON();
  } catch {
    // If allFlagsState fails, bootstrap stays undefined.
  }

  const context = session.getContext();

  return (
    <LDIsomorphicClientProvider
      clientSideId={clientSideId}
      context={context}
      bootstrap={bootstrap}
      options={options}
    >
      {children}
    </LDIsomorphicClientProvider>
  );
}
