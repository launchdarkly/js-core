import type { Encoding, Info, Platform, PlatformData, Requests, SdkData, Storage } from '@common';

import { setupCrypto } from './crypto';

const encoding: Encoding = {
  btoa: (s: string) => Buffer.from(s).toString('base64'),
};

const info: Info = {
  platformData(): PlatformData {
    return {
      os: {
        name: 'iOS',
        version: '17.17',
        arch: 'ARM64',
      },
      name: 'The SDK Name',
      additional: {
        nodeVersion: '42',
      },
      ld_application: {
        key: '',
        envAttributesVersion: '1.0',
        id: 'com.testapp.ld',
        name: 'LDApplication.TestApp',
        version: '1.1.1',
      },
      ld_device: {
        key: '',
        envAttributesVersion: '1.0',
        os: { name: 'ios', version: '17', family: 'apple' },
        manufacturer: 'apple',
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

const storage: Storage = {
  get: jest.fn(),
  set: jest.fn(),
  clear: jest.fn(),
};

// eslint-disable-next-line import/no-mutable-exports
export let basicPlatform: Platform;
export const setupBasicPlatform = () => {
  basicPlatform = {
    encoding,
    info,
    crypto: setupCrypto(),
    requests,
    storage,
  };
};
