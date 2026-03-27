import React from 'react';

import { LDIsomorphicClientProvider } from '@launchdarkly/react-sdk';
import type { LDReactProviderOptions } from '@launchdarkly/react-sdk';

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
   * The LaunchDarkly client-side ID used to initialize the browser SDK.
   */
  clientSideId: string;

  /**
   * Additional options forwarded to the underlying client provider and ultimately
   * to {@link createLDReactProvider}. This allows control over `ldOptions`,
   * `startOptions`, `deferInitialization`, and `reactContext`.
   *
   * The `bootstrap` field within these options will be overridden by server-evaluated
   * flag data from the session.
   */
  options?: Omit<LDReactProviderOptions, 'bootstrap'>;

  /**
   * Child components. Server components and client components can both be children.
   */
  children: React.ReactNode;
}

/**
 * An async React Server Component that bootstraps the LaunchDarkly browser client with
 * server-evaluated flag values.
 *
 * @remarks
 * Place this component near the root of your layout (e.g. in `layout.tsx`). It evaluates
 * all flags on the server, then passes the results to {@link LDIsomorphicClientProvider}
 * so the client-side SDK starts with real flag values.
 *
 * After hydration, the client-side SDK can open a streaming connection and live flag changes
 * propagate normally to all `useVariation` / `useBoolVariation` etc. hooks.
 *
 * Server components in the same tree can continue to call `session.boolVariation(...)` etc.
 * directly. Client components use the standard `useBoolVariation(...)` hooks.
 *
 * See the `server-only` example for how to use this component.
 */
export async function LDIsomorphicProvider({
  session,
  clientSideId,
  options,
  children,
}: LDIsomorphicProviderProps) {
  let bootstrap: unknown = {};
  try {
    const flagsState = await session.allFlagsState({ clientSideOnly: true });
    bootstrap = flagsState.toJSON();
  } catch {
    // If allFlagsState fails, fall back to an empty bootstrap
    // so the client SDK can still initialize and fetch flags normally.
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
