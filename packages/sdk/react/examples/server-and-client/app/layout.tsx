import '@launchpad-ui/tokens/dist/fonts.css';
import '@launchpad-ui/tokens/dist/index.css';
import '@launchpad-ui/tokens/dist/themes.css';

import './globals.css';
import LDClientProvider from './ld-client-provider';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <LDClientProvider>{children}</LDClientProvider>
      </body>
    </html>
  );
}
