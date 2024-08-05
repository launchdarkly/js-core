import { LDLogger, Platform } from '@launchdarkly/js-client-sdk-common';

import PlatformCrypto from './crypto';
import PlatformEncoding from './PlatformEncoding';
import PlatformInfo from './PlatformInfo';
import PlatformRequests from './PlatformRequests';
import PlatformStorage from './PlatformStorage';

const createPlatform = (logger: LDLogger): Platform => ({
  crypto: new PlatformCrypto(),
  info: new PlatformInfo(logger),
  requests: new PlatformRequests(logger),
  encoding: new PlatformEncoding(),
  storage: new PlatformStorage(logger),
});

export default createPlatform;
