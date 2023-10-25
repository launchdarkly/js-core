import type { Dispatch, SetStateAction } from 'react';

import { LDContext } from '@launchdarkly/js-client-sdk-common';

import ReactNativeLDClient from '../ReactNativeLDClient';
import { ReactSdkContext } from './reactSdkContext';

const setupListeners = (
  client: ReactNativeLDClient,
  setState: Dispatch<SetStateAction<ReactSdkContext>>,
) => {
  client.on('identify:loading', (c: LDContext) => {
    console.log(`=========== identify:loading: ${JSON.stringify(c)}`);
    setState({ client, ldContextInfo: { context: c, identifyStatus: 'loading' } });
  });

  client.on('identify:success', (c: LDContext) => {
    console.log(`=========== identify:success: ${JSON.stringify(c)}`);
    setState({ client, ldContextInfo: { context: c, identifyStatus: 'success' } });
  });

  client.on('identify:error', (c: LDContext, e: any) => {
    console.log(`=========== identify:error: ${JSON.stringify(c)}, ${e}`);
    setState({ client, ldContextInfo: { context: c, identifyStatus: 'error', error: e } });
  });

  client.on('variation:error', (c: LDContext, e: any) => {
    console.log(`=========== variation:error: ${JSON.stringify(c)}, ${e}`);
  });

  client.on('variation:success', (c: LDContext) => {
    console.log(`=========== variation:success: ${JSON.stringify(c)}`);
  });
};

export default setupListeners;
