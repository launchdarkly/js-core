import React, { PropsWithChildren, useEffect, useState } from 'react';

import { type LDContext } from '@launchdarkly/js-client-sdk-common';

import ReactNativeLDClient from '../ReactNativeLDClient';
import { Provider, ReactContext } from './reactContext';
import setupListeners from './setupListeners';

type LDProps = {
  client: ReactNativeLDClient;
  context?: LDContext;
};

/**
 * This is the LaunchDarkly Provider which uses the React context api to store
 * and pass data to child components through hooks.
 *
 * @param client The ReactNativeLDClient object. Initialize this object separately
 * and then set this prop when declaring the LDProvider.
 * @param context Optional. The LDContext object. If set, the LDProvider will
 * `identify` this context on application mount. If not set, default flag values
 * will be returned. You can run `identify` at a later time.
 * @param children
 * @constructor
 */
const LDProvider = ({ client, context, children }: PropsWithChildren<LDProps>) => {
  const [state, setState] = useState<ReactContext>({ client });

  useEffect(() => {
    setupListeners(client, setState);

    if (context) {
      client
        .identify(context)
        .catch((e: any) =>
          client.logger.debug(`LaunchDarkly React Native Sdk identify error: ${e}`),
        );
    }
  }, []);

  return <Provider value={state}>{children}</Provider>;
};

export default LDProvider;
