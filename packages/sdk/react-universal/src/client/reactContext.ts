'use client';

import { createContext } from 'react';

import type { LDContext, LDFlagSet } from '@launchdarkly/node-server-sdk';

import type { JSSdk } from '../types';

export type ReactContext = {
  jsSdk?: JSSdk;
  context: LDContext;
  bootstrap: LDFlagSet;
};

export const context = createContext<ReactContext>({
  jsSdk: undefined as any,
  context: {} as any,
  bootstrap: undefined as any,
});

const { Provider, Consumer } = context;

export { Provider, Consumer };
