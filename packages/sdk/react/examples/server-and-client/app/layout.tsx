import '@launchpad-ui/tokens/dist/fonts.css';
import '@launchpad-ui/tokens/dist/index.css';
import '@launchpad-ui/tokens/dist/themes.css';

import { LDIsomorphicProvider } from '@launchdarkly/react-sdk/server';

import './globals.css';
import serverSession from './lib/ld-server';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <LDIsomorphicProvider
          session={serverSession}
          clientSideId={process.env.LD_CLIENT_SIDE_ID || 'test-client-side-id'}
        >
          {children}
        </LDIsomorphicProvider>
      </body>
    </html>
  );
}
