import { Crypto, Hasher, LDLogger, Platform, Storage } from '@launchdarkly/js-sdk-common';

import { ItemDescriptor } from '../../src/flag-manager/ItemDescriptor';
import { Flag } from '../../src/types';

export function makeMockPlatform(storage: Storage, crypto: Crypto): Platform {
  return {
    storage,
    crypto,
    info: {
      platformData: jest.fn(),
      sdkData: jest.fn(),
    },
    requests: {
      fetch: jest.fn(),
      createEventSource: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
  };
}

export function makeMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get: async (key: string) => {
      const value = data.get(key);
      return value !== undefined ? value : null;
    },
    set: async (key: string, value: string) => {
      data.set(key, value);
    },
    clear: async (key: string) => {
      data.delete(key);
    },
  };
}

export function makeCorruptStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get: async (key: string) => {
      const value = data.get(key);
      return value !== undefined ? 'corruption!!!!!' : null;
    },
    set: async (key: string, value: string) => {
      data.set(key, value);
    },
    clear: async (key: string) => {
      data.delete(key);
    },
  };
}

export function makeMockCrypto(): Crypto {
  let counter = 0;
  let lastInput = '';
  const hasher: Hasher = {
    update: jest.fn((input) => {
      lastInput = input;
      return hasher;
    }),
    digest: jest.fn(() => `${lastInput}Hashed`),
  };

  return {
    createHash: jest.fn(() => hasher),
    createHmac: jest.fn(),
    randomUUID: jest.fn(() => {
      counter += 1;
      return `${counter}`;
    }),
  };
}

export function makeMockLogger(): LDLogger {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

export function makeMockFlag(version: number = 1, value: any = undefined): Flag {
  return {
    version,
    flagVersion: version,
    value,
    variation: 0,
    trackEvents: false,
  };
}

export function makeMockItemDescriptor(
  version: number = 1,
  value: any = undefined,
): ItemDescriptor {
  return {
    version,
    flag: makeMockFlag(version, value),
  };
}

export function makeIncrementingStamper(): () => number {
  let count = 0;
  return () => {
    count += 1;
    return count;
  };
}
