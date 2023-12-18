import { createContext } from 'react';

import { LDClient } from '@launchdarkly/js-client-sdk-common';

export type ReactContext = {
  client: LDClient;
};

export const context = createContext<ReactContext>({
  client: {} as any,
});

const { Provider, Consumer } = context;

export { Provider, Consumer };
