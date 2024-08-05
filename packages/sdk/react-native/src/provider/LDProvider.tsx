import React, { PropsWithChildren, useEffect, useState } from 'react';

import ReactNativeLDClient from '../ReactNativeLDClient';
import { Provider, ReactContext } from './reactContext';
import setupListeners from './setupListeners';

type LDProps = {
  client: ReactNativeLDClient;
};

/**
 * This is the LaunchDarkly Provider which uses the React context api to store
 * and pass data to child components through hooks.
 *
 * @param client The ReactNativeLDClient object. Initialize this object separately
 * and then set this prop when declaring the LDProvider.
 * @param children
 *
 * @constructor
 */
const LDProvider = ({ client, children }: PropsWithChildren<LDProps>) => {
  const [state, setState] = useState<ReactContext>({ client });

  useEffect(() => {
    setupListeners(client, setState);
  }, []);

  return <Provider value={state}>{children}</Provider>;
};

export default LDProvider;
