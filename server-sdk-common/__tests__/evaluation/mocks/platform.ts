import {
  Info, Options, Platform, PlatformData, Requests, Response, SdkData,
} from '../../../src/platform';
import { crypto } from './hasher';

const info: Info = {
  platformData(): PlatformData {
    return {};
  },
  sdkData(): SdkData {
    return {};
  },
};

const requests: Requests = {
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  fetch(url: string, options?: Options): Promise<Response> {
    throw new Error('Function not implemented.');
  },
};

const basicPlatform: Platform = {
  info,
  crypto,
  requests,
};

export default basicPlatform;
