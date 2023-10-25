import type { Dispatch, SetStateAction } from 'react';

import { LDContext } from '@launchdarkly/js-client-sdk-common';

import ReactNativeLDClient from '../ReactNativeLDClient';
import { ReactSdkContext } from './reactSdkContext';

const setupListeners = (
  client: ReactNativeLDClient,
  setState: Dispatch<SetStateAction<ReactSdkContext>>,
) => {
  const { logger } = client;

  client.on('identify:loading', (c: LDContext) => {
    logger.debug(`=========== identify:loading: ${JSON.stringify(c)}`);
    setState({ client, ldContextInfo: { context: c, identifyStatus: 'loading' } });
  });

  client.on('identify:success', (c: LDContext) => {
    logger.debug(`=========== identify:success: ${JSON.stringify(c)}`);
    setState({ client, ldContextInfo: { context: c, identifyStatus: 'success' } });
  });

  client.on('identify:error', (c: LDContext, e: any) => {
    logger.debug(`=========== identify:error: ${JSON.stringify(c)}, ${e}`);
    setState({ client, ldContextInfo: { context: c, identifyStatus: 'error', error: e } });
  });

  client.on('variation:error', (c: LDContext, e: any) => {
    logger.debug(`=========== variation:error: ${JSON.stringify(c)}, ${e}`);
  });

  client.on('variation:success', (c: LDContext) => {
    logger.debug(`=========== variation:success: ${JSON.stringify(c)}`);
  });
};

export default setupListeners;
