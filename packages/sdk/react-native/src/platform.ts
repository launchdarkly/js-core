/* eslint-disable max-classes-per-file */
import type {
  Encoding,
  EventSource,
  EventSourceInitDict,
  Info,
  Options,
  Platform,
  PlatformData,
  Requests,
  Response,
  SdkData,
} from '@launchdarkly/js-sdk-common';

import { name, version } from '../package.json';
import { btoa } from './utils';

class PlatformRequests implements Requests {
  createEventSource(_url: string, _eventSourceInitDict: EventSourceInitDict): EventSource {
    throw new Error('todo');
  }

  fetch(url: string, options?: Options): Promise<Response> {
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

// @ts-ignore
const platform: Platform = {
  info: new PlatformInfo(),
  requests: new PlatformRequests(),
  encoding: new PlatformEncoding(),
};

export default platform;
