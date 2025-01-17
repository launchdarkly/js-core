import { PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common';

import { setupCrypto } from './setupCrypto';

const setupInfo = () => ({
  platformData: jest.fn(
    (): PlatformData => ({
      os: {
        name: 'An OS',
        version: '1.0.1',
        arch: 'An Arch',
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
        os: { name: 'Another OS', version: '99', family: 'orange' },
        manufacturer: 'coconut',
      },
    }),
  ),
  sdkData: jest.fn(
    (): SdkData => ({
      name: 'An SDK',
      version: '2.0.2',
      userAgentBase: 'TestUserAgent',
      wrapperName: 'Rapper',
      wrapperVersion: '1.2.3',
    }),
  ),
});

export const createBasicPlatform = () => ({
  encoding: {
    btoa: (s: string) => Buffer.from(s).toString('base64'),
  },
  info: setupInfo(),
  crypto: setupCrypto(),
  requests: {
    fetch: jest.fn(),
    createEventSource: jest.fn(),
    getEventSourceCapabilities: jest.fn(),
  },
  storage: {
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
  },
});
