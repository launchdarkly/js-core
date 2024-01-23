import { createContext } from 'react';

import type ReactLDClient from '../ReactLDClient';

export type ReactContext = {
  client: ReactLDClient;
};

export const context = createContext<ReactContext>({
  client: {} as any,
});

const { Provider, Consumer } = context;

export { Provider, Consumer };
