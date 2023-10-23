import { PropsWithChildren, useEffect, useState } from 'react';

import { LDClient, LDContext, LDOptions } from '@launchdarkly/js-client-sdk-common';

import init from '../init';
import { Provider, ReactSdkContext } from './reactSdkContext';

type LDProps = {
  clientSideSdkKey: string;
  context: LDContext;
  options?: LDOptions;
};
const LDProvider = ({
  clientSideSdkKey,
  context,
  options,
  children,
}: PropsWithChildren<LDProps>) => {
  const [value, setValue] = useState<ReactSdkContext>({});

  useEffect(() => {
    init(clientSideSdkKey, context, options).then((ldClient: LDClient) => {
      setValue({ allFlags: ldClient.allFlags(), ldClient });
    });
  }, []);

  return <Provider value={value}>{children}</Provider>;
};

export default LDProvider;
