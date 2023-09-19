import {
  EventSource,
  EventSourceInitDict,
  Info,
  Options,
  Platform,
  PlatformData,
  Requests,
  Response,
  SdkData,
} from '../../api';
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
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  fetch(url: string, options?: Options): Promise<Response> {
    throw new Error('Function not implemented.');
  },

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource {
    throw new Error('Function not implemented.');
  },
};

const basicPlatform: Platform = {
  info,
  crypto,
  requests,
};

export default basicPlatform;
