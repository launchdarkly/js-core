import '@launchpad-ui/tokens/dist/fonts.css';
import '@launchpad-ui/tokens/dist/index.css';
import '@launchpad-ui/tokens/dist/themes.css';

import './globals.css';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
