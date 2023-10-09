import type { Base64, Info, Platform, PlatformData, PlatformDom, Requests, SdkData } from '@common';

import { crypto } from './hasher';

const base64: Base64 = {
  btoa: (s: string) => Buffer.from(s).toString('base64'),
};

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

export const basicPlatform: Platform = {
  info,
  crypto,
  requests,
};

export const basicPlatformDom: PlatformDom = { ...basicPlatform, base64 };
