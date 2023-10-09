import type { ClientContext } from '@common';

import { basicPlatform, basicPlatformDom } from './platform';

export const clientContext: ClientContext = {
  basicConfiguration: {
    sdkKey: 'testSdkKey',
    serviceEndpoints: { events: '', polling: '', streaming: 'https://mockstream.ld.com' },
  },
  platform: basicPlatform,
};

export const clientContextDom: ClientContext = {
  basicConfiguration: {
    sdkKey: 'testSdkKey',
    serviceEndpoints: { events: '', polling: '', streaming: 'https://mockstream.ld.com' },
  },
  platform: basicPlatformDom,
};
