import { createContext } from 'react';

import type ReactNativeLDClient from '../ReactNativeLDClient';

export type ReactContext = {
  client: ReactNativeLDClient;
};

export const context = createContext<ReactContext>({
  client: {} as any,
});

const { Provider, Consumer } = context;

export { Provider, Consumer };
