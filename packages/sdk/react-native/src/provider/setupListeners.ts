import type { Dispatch, SetStateAction } from 'react';

import ReactNativeLDClient from '../ReactNativeLDClient';
import { ReactContext } from './reactContext';

const setupListeners = (
  client: ReactNativeLDClient,
  setState: Dispatch<SetStateAction<ReactContext>>,
) => {
  client.on('change', () => {
    setState({ client });
  });
};

export default setupListeners;
