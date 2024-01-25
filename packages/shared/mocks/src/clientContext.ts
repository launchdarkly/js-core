import type { ClientContext } from '@common';

import { basicPlatform } from './platform';

// eslint-disable-next-line import/no-mutable-exports
export let clientContext: ClientContext;
export const setupClientContext = () => {
  clientContext = {
    basicConfiguration: {
      sdkKey: 'testSdkKey',
      serviceEndpoints: {
        events: '',
        polling: '',
        streaming: 'https://mockstream.ld.com',
        diagnosticEventPath: '/diagnostic',
        analyticsEventPath: '/bulk',
        includeAuthorizationHeader: true,
      },
    },
    platform: basicPlatform,
  };
};
