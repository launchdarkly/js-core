import type { Dispatch, SetStateAction } from 'react';

import type { LDContext, LDFlagChangeset } from '@launchdarkly/js-client-sdk-common';

import ReactNativeLDClient from '../ReactNativeLDClient';
import { ReactContext } from './reactContext';

const setupListeners = (
  client: ReactNativeLDClient,
  setState: Dispatch<SetStateAction<ReactContext>>,
) => {
  client.on('initializing', (c: LDContext) => {
    setState({ client, context: c, dataSource: { status: 'initializing' } });
  });

  client.on('ready', (c: LDContext) => {
    setState({ client, context: c, dataSource: { status: 'ready' } });
  });

  client.on('error', (c: LDContext, e: any) => {
    setState({ client, context: c, dataSource: { status: 'error', error: e } });
  });

  client.on('change', (c: LDContext, _changes: LDFlagChangeset) => {
    setState({ client, context: c, dataSource: { status: 'change' } });
  });
};

export default setupListeners;
