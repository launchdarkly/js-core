import LaunchDarklyProvider from 'components/launchdarklyProvider';
import Nav from 'components/nav';
import { ldEdgeClient } from 'lib/ldEdgeClient';
import { headers } from 'next/headers';
import { ReactElement } from 'react';
import 'tailwindcss/tailwind.css';

import { LDMultiKindContext } from '@launchdarkly/vercel-server-sdk';

// Specify the `edge` runtime to use the LaunchDarkly Edge SDK in layouts
export const runtime = 'edge';

export default async function RootLayout({ children }: { children: ReactElement }) {
  const headersList = await headers();
  await ldEdgeClient.waitForInitialization();

  // Here we are using basic information from the request as the LaunchDarkly context. If you have session auth in place,
  // you will likely want to also include user and organization context.
  const context: LDMultiKindContext = {
    kind: 'multi',
    user: { key: 'anonymous', anonymous: true },
    'user-agent': { key: headersList.get('user-agent') || 'unknown' },
    method: {
      key: 'GET',
    },
  };

  // The allFlagsState call is used to evaluate all feature flags for a given context so they can be bootstrapped but the
  // LaunchDarkly React SDK in the `<LaunchDarklyProvider>` component.
  const allFlags = (await ldEdgeClient.allFlagsState(context)).toJSON() as {
    'bootstrap-flags': boolean;
  };
  const bootstrappedFlags = allFlags['bootstrap-flags'] ? allFlags : undefined;

  return (
    <html lang="en">
      <body>
        <LaunchDarklyProvider
          envId={process.env.LD_CLIENT_SIDE_ID || ''}
          context={context}
          bootstrappedFlags={bootstrappedFlags}
        >
          <Nav />
          {children}
        </LaunchDarklyProvider>
      </body>
    </html>
  );
}
