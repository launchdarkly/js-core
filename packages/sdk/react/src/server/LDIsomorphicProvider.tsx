import React from 'react';

import { LDBootstrapClientProvider } from '@launchdarkly/react-sdk';
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
 * all flags on the server, then passes the results to {@link LDBootstrapClientProvider}
 * so the browser SDK starts with real flag values — **no client-side flag fetch waterfall**.
 *
 * After hydration, the browser SDK opens a streaming connection and live flag changes
 * propagate normally to all `useVariation` / `useBoolVariation` etc. hooks.
 *
 * Server components in the same tree can continue to call `session.boolVariation(...)` etc.
 * directly. Client components use the standard `useBoolVariation(...)` hooks.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { LDIsomorphicProvider } from '@launchdarkly/react-sdk/server';
 * import { serverSession } from './lib/ld-server';
 *
 * export default async function RootLayout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <html>
 *       <body>
 *         <LDIsomorphicProvider
 *           session={serverSession}
 *           clientSideId={process.env.LD_CLIENT_SIDE_ID!}
 *         >
 *           {children}
 *         </LDIsomorphicProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export async function LDIsomorphicProvider({
  session,
  clientSideId,
  children,
}: LDIsomorphicProviderProps) {
  const flagsState = await session.allFlagsState();
  const context = session.getContext();

  return (
    <LDBootstrapClientProvider
      clientSideId={clientSideId}
      context={context}
      bootstrap={flagsState.toJSON()}
    >
      {children}
    </LDBootstrapClientProvider>
  );
}
