import { getLDContext } from '@/app/utils';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ReactNode } from 'react';

import { LDProvider } from '@launchdarkly/react-universal-sdk/client';
import { getBootstrap } from '@launchdarkly/react-universal-sdk/server';

import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LaunchDarkly NextJS Universal',
  description: 'Universal SDK Configuration for NextJS App Router',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const clientSideID = process.env.NEXT_PUBLIC_LD_CLIENT_SIDE_ID || '';

  // You must supply an LDContext. For example, here getLDContext
  // inspects cookies and defaults to anonymous.
  const context = getLDContext();

  // A bootstrap is required to initialize LDProvider.
  const bootstrap = await getBootstrap(context);

  return (
    <html lang="en">
      <body className={inter.className}>
        <LDProvider
          clientSideID={clientSideID}
          context={context}
          bootstrap={bootstrap}
          options={{ withReasons: true }}
        >
          {children}
        </LDProvider>
      </body>
    </html>
  );
}
