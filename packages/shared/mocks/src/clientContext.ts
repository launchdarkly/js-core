import type { ClientContext } from 'ld-common';

import platform from './platform';

const clientContext: ClientContext = {
  basicConfiguration: {
    sdkKey: 'testSdkKey',
    serviceEndpoints: { events: '', polling: '', streaming: 'https://mockstream.ld.com' },
  },
  platform,
};

export default clientContext;
