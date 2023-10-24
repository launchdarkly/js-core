import { PropsWithChildren, useEffect, useState } from 'react';

import { LDContext } from '@launchdarkly/js-client-sdk-common';

import ReactNativeLDClient from '../ReactNativeLDClient';
import { Provider, ReactSdkContext } from './reactSdkContext';

type LDProps = {
  client: ReactNativeLDClient;
  context?: LDContext;
};

const LDProvider = ({ client, context, children }: PropsWithChildren<LDProps>) => {
  const [value, setValue] = useState<ReactSdkContext>({ client, ldContextInfo: {} });

  useEffect(() => {
    if (context) {
      setValue({ client, ldContextInfo: { status: 'loading' } });
      client
        .identify(context)
        .then(() => {
          setValue({ client, ldContextInfo: { status: 'success' } });
        })
        .catch((e) => {
          setValue({ client, ldContextInfo: { error: e, status: 'error' } });
        });
    }
  }, []);

  return <Provider value={value}>{children}</Provider>;
};

export default LDProvider;
