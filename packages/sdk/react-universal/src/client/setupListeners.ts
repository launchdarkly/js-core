import type { Dispatch, SetStateAction } from 'react';

import type { JSSdk } from '../types';
import type { ReactContext } from './reactContext';

export const setupListeners = (jsSdk: JSSdk, setState: Dispatch<SetStateAction<ReactContext>>) => {
  jsSdk.on('change', () => {
    setState((prevState) => ({ ...prevState, jsSdk }));
  });
};
