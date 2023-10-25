import { createContext } from 'react';

import { LDClient, LDContext } from '@launchdarkly/js-client-sdk-common';

export type LDContextInfo = {
  context?: LDContext;
  identifyStatus?: 'loading' | 'error' | 'success';
  error?: Error;
};

export type ReactSdkContext = {
  client: LDClient;
  ldContextInfo: LDContextInfo;
};

export const context = createContext<ReactSdkContext>({
  client: {} as any,
  ldContextInfo: {},
});

const { Provider, Consumer } = context;

export { Provider, Consumer };
