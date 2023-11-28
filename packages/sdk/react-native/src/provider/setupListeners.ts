import type { Dispatch, SetStateAction } from 'react';

import { LDContext } from '@launchdarkly/js-client-sdk-common';

import ReactNativeLDClient from '../ReactNativeLDClient';
import { ReactContext } from './reactContext';

const setupListeners = (
  client: ReactNativeLDClient,
  setState: Dispatch<SetStateAction<ReactContext>>,
) => {
  const { logger } = client;

  client.on('connecting', (c: LDContext) => {
    logger.debug(`=========== connecting: ${JSON.stringify(c)}`);
    setState({ client, context: c, dataSource: { status: 'connecting' } });
  });

  client.on('ready', (c: LDContext) => {
    logger.debug(`=========== ready: ${JSON.stringify(c)}`);
    setState({ client, context: c, dataSource: { status: 'ready' } });
  });

  client.on('error', (c: LDContext, e: any) => {
    logger.debug(`=========== identify:error: ${JSON.stringify(c)}, ${e}`);
    setState({ client, context: c, dataSource: { status: 'error', error: e } });
  });

  // client.on('variation:error', (c: LDContext, e: any) => {
  //   logger.debug(`=========== variation:error: ${JSON.stringify(c)}, ${e}`);
  // });
  //
  // client.on('variation:success', (c: LDContext) => {
  //   logger.debug(`=========== variation:success: ${JSON.stringify(c)}`);
  // });
};

export default setupListeners;
