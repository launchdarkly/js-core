'use client';

// TODO: nextjs state management guide says in order to use the Context API
// we have to create a separate providers component which 'use client'.
// https://vercel.com/guides/react-context-state-management-nextjs#rendering-third-party-context-providers-in-server-components
// import { AutoEnvAttributes, ReactLDClient } from '@launchdarkly/react-sdk';
// TODO: client entrypoint is in layout.tsx but we init ldclient here because
// this file is imported in RootLayout so it's effectively the same.
// https://github.com/vercel/next.js/issues/49850#issuecomment-1569814826
import { useEffect } from 'react';

import { AutoEnvAttributes, LDProvider, ReactLDClient } from '@launchdarkly/react-sdk';

let featureClient: ReactLDClient;

// @ts-ignore
export default function Providers({ children }) {
  useEffect(() => {
    featureClient = new ReactLDClient(process.env.LD_CLIENT_SIDE_ID!, AutoEnvAttributes.Enabled, {
      debug: true,
      applicationInfo: {
        id: 'ld-react-test-app',
        version: '0.0.1',
      },
    });
  }, []);

  return <LDProvider client={featureClient}>{children}</LDProvider>;
  // return children;
}
