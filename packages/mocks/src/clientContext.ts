import type { ClientContext } from 'shared-common-types';

import platform from './platform';

const clientContext: ClientContext = {
  basicConfiguration: {
    sdkKey: 'testSdkKey',
    serviceEndpoints: { events: '', polling: '', streaming: 'https://mockstream.ld.com' },
  },
  platform,
};

export default clientContext;
