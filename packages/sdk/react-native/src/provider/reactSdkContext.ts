import { createContext } from 'react';

import { LDClient, LDFlagSet } from '@launchdarkly/js-client-sdk-common';

type ReactSdkContext = {
  allFlags?: LDFlagSet;
  ldClient?: LDClient;
};

const context = createContext<ReactSdkContext>({});

const { Provider, Consumer } = context;

export { context, Provider, Consumer, ReactSdkContext };
