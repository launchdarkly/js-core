import type { Dispatch, SetStateAction } from 'react';

import ReactLDClient from '../ReactLDClient';
import { ReactContext } from './reactContext';

const setupListeners = (
  client: ReactLDClient,
  setState: Dispatch<SetStateAction<ReactContext>>,
) => {
  client.on('change', () => {
    setState({ client });
  });
};

export default setupListeners;
