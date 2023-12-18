import { PropsWithChildren, useEffect, useState } from 'react';

import { type LDContext } from '@launchdarkly/js-client-sdk-common';

import ReactNativeLDClient from '../ReactNativeLDClient';
import { Provider, ReactContext } from './reactContext';
import setupListeners from './setupListeners';

type LDProps = {
  client: ReactNativeLDClient;
  context?: LDContext;
};

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
