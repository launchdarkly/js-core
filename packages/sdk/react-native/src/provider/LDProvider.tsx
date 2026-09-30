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
    // Listeners are set up once on mount. The client prop is created once by the
    // application and is not expected to change for the life of the provider.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Provider value={state}>{children}</Provider>;
};

export default LDProvider;
