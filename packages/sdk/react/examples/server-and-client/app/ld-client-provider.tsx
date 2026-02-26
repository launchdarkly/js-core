'use client';

import type { ReactNode } from 'react';

import { createLDReactProvider } from '@launchdarkly/react-sdk';

import ldClient from './lib/ld-client';

const LDProvider = createLDReactProvider(ldClient);

export default function LDClientProvider({ children }: { children: ReactNode }) {
  return <LDProvider>{children}</LDProvider>;
}
