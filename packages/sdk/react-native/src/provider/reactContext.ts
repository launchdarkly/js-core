import { createContext } from 'react';

import { LDClient, LDContext } from '@launchdarkly/js-client-sdk-common';

export type ReactContext = {
  client: LDClient;
  context?: LDContext;
  /**
   * Information about the LDClient state.
   */
  dataSource: {
    status?: 'connecting' | 'ready' | 'error';
    error?: Error;
  };
};

export const context = createContext<ReactContext>({
  client: {} as any,
  dataSource: {},
});

const { Provider, Consumer } = context;

export { Provider, Consumer };
