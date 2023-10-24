import { createContext } from 'react';

import { LDClient } from '@launchdarkly/js-client-sdk-common';

export type LDContextInfo = {
  status?: 'loading' | 'error' | 'success';
  error?: Error;
};

export type ReactSdkContext = {
  client?: LDClient;
  ldContextInfo: LDContextInfo;
};

export const context = createContext<ReactSdkContext>({ ldContextInfo: {} });

const { Provider, Consumer } = context;

export { Provider, Consumer };
