/* eslint-disable max-classes-per-file */

/**
 * The LaunchDarkly SDK uses async-storage for bootstrapping and this is a native
 * dependency.
 *
 * If you are using expo, then adding the LaunchDarkly React Native
 * SDK from npm and re-running pod install should suffice.
 *
 * If you are not using expo, you will need to explicitly add
 * @react-native-async-storage/async-storage as a dependency to your project
 * and re-run pod install for auto-linking to work. This is because auto-link
 * does not work with transitive dependencies:
 * https://github.com/react-native-community/cli/issues/1347
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// @ts-ignore
import type {
  Crypto,
  Encoding,
  EventName,
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

import { name, version } from '../package.json';
import { btoa, uuidv4 } from './polyfills';
import RNEventSource from './react-native-sse';

class PlatformRequests implements Requests {
  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
    return new RNEventSource<EventName>(url, {
      headers: eventSourceInitDict.headers,
      retryAndHandleError: eventSourceInitDict.errorFilter,
    });
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
  platformData(): PlatformData {
    return {
      name: 'React Native',
    };
  }

  sdkData(): SdkData {
    return {
      name,
      version,
      userAgentBase: 'ReactNativeClient',
    };
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
    return uuidv4();
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
  info: new PlatformInfo(),
  requests: new PlatformRequests(),
  encoding: new PlatformEncoding(),
  storage: new PlatformStorage(logger),
});

export default createPlatform;
