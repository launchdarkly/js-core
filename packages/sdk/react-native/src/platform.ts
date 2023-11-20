/* eslint-disable max-classes-per-file */
import type {
  Crypto,
  Encoding,
  EventSource,
  EventSourceInitDict,
  Hasher,
  Hmac,
  Info,
  Options,
  Platform,
  PlatformData,
  Requests,
  Response,
  SdkData,
} from '@launchdarkly/js-sdk-common';
import { EventName } from '@launchdarkly/js-sdk-common';

import { name, version } from '../package.json';
import { btoa, EventSource as RNEventSource, uuidv4 } from './polyfills';

class PlatformRequests implements Requests {
  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
    return new RNEventSource<EventName>(url, eventSourceInitDict);
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
const platform: Platform = {
  crypto: new PlatformCrypto(),
  info: new PlatformInfo(),
  requests: new PlatformRequests(),
  encoding: new PlatformEncoding(),
};

export default platform;
