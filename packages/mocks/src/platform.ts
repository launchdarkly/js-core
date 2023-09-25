import type { Info, Platform, PlatformData, Requests, SdkData } from 'shared-common-types';

import { crypto } from './hasher';

const info: Info = {
  platformData(): PlatformData {
    return {
      os: {
        name: 'An OS',
        version: '1.0.1',
        arch: 'An Arch',
      },
      name: 'The SDK Name',
      additional: {
        nodeVersion: '42',
      },
    };
  },
  sdkData(): SdkData {
    return {
      name: 'An SDK',
      version: '2.0.2',
      userAgentBase: 'TestUserAgent',
      wrapperName: 'Rapper',
      wrapperVersion: '1.2.3',
    };
  },
};

const requests: Requests = {
  fetch: jest.fn(),
  createEventSource: jest.fn(),
};

const basicPlatform: Platform = {
  info,
  crypto,
  requests,
};

export default basicPlatform;
