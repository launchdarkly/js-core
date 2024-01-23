/* eslint-disable max-classes-per-file */
import crypto from 'crypto';

import type {
  Crypto,
  Encoding, // EventName,
  EventSource,
  EventSourceInitDict,
  Hasher,
  Hmac,
  Info,
  LDLogger,
  Options,
  Platform,
  PlatformData,
  Requests,
  Response,
  SdkData,
  Storage,
} from '@launchdarkly/js-client-sdk-common';

import { name, version } from '../../package.json';
// import { btoa, uuidv4 } from '../polyfills';
// import RNEventSource from '../react-native-sse';
import { ldApplication, ldDevice } from './autoEnv';

class PlatformRequests implements Requests {
  createEventSource(_url: string, _eventSourceInitDict: EventSourceInitDict): EventSource {
    // return new EventSource(url, {
    //   headers: eventSourceInitDict.headers,
    //   retryAndHandleError: eventSourceInitDict.errorFilter,
    // });

    // @ts-ignore
    return undefined;
  }

  fetch(url: string, options?: Options): Promise<Response> {
    // @ts-ignore
    return fetch(url, options);
  }
}
class PlatformEncoding implements Encoding {
  btoa(data: string): string {
    return btoa(data);
  }
}

class PlatformInfo implements Info {
  constructor(private readonly logger: LDLogger) {}

  platformData(): PlatformData {
    const data = {
      name: 'React',
      ld_application: ldApplication,
      ld_device: ldDevice,
    };

    this.logger.debug(`platformData: ${JSON.stringify(data, null, 2)}`);
    return data;
  }

  sdkData(): SdkData {
    const data = {
      name,
      version,
      userAgentBase: 'ReactClient',
    };

    this.logger.debug(`sdkData: ${JSON.stringify(data, null, 2)}`);
    return data;
  }
}

class PlatformCrypto implements Crypto {
  createHash(_algorithm: string): Hasher {
    throw new Error('not implemented');
  }

  createHmac(_algorithm: string, _key: string): Hmac {
    throw new Error('not implemented');
  }

  randomUUID(): string {
    return crypto.randomUUID();
  }
}

class PlatformStorage implements Storage {
  constructor(private readonly logger: LDLogger) {}
  async clear(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = localStorage.getItem(key);
      return value ?? null;
    } catch (error) {
      this.logger.debug(`Error getting localStorage key: ${key}, error: ${error}`);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      this.logger.debug(`Error saving localStorage key: ${key}, value: ${value}, error: ${error}`);
    }
  }
}

const createPlatform = (logger: LDLogger): Platform => ({
  crypto: new PlatformCrypto(),
  info: new PlatformInfo(logger),
  requests: new PlatformRequests(),
  encoding: new PlatformEncoding(),
  storage: new PlatformStorage(logger),
});

export default createPlatform;
