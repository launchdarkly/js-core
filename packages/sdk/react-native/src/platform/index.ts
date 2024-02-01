/* eslint-disable max-classes-per-file */
import type {
  Encoding,
  EventName,
  EventSource,
  EventSourceInitDict,
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
import RNEventSource from '../fromExternal/react-native-sse';
import { btoa } from '../polyfills';
import { ldApplication, ldDevice } from './autoEnv';
import AsyncStorage from './ConditionalAsyncStorage';
import PlatformCrypto from './crypto';

class PlatformRequests implements Requests {
  eventSource?: RNEventSource<EventName>;

  constructor(private readonly logger: LDLogger) {}

  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
    this.eventSource = new RNEventSource<EventName>(url, {
      headers: eventSourceInitDict.headers,
      retryAndHandleError: eventSourceInitDict.errorFilter,
      logger: this.logger,
    });

    return this.eventSource;
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
      name: 'React Native',
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
      userAgentBase: 'ReactNativeClient',
    };

    this.logger.debug(`sdkData: ${JSON.stringify(data, null, 2)}`);
    return data;
  }
}

class PlatformStorage implements Storage {
  constructor(private readonly logger: LDLogger) {}
  async clear(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ?? null;
    } catch (error) {
      this.logger.debug(`Error getting AsyncStorage key: ${key}, error: ${error}`);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      this.logger.debug(`Error saving AsyncStorage key: ${key}, value: ${value}, error: ${error}`);
    }
  }
}

const createPlatform = (logger: LDLogger): Platform => ({
  crypto: new PlatformCrypto(),
  info: new PlatformInfo(logger),
  requests: new PlatformRequests(logger),
  encoding: new PlatformEncoding(),
  storage: new PlatformStorage(logger),
});

export default createPlatform;
