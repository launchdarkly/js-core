import { LDLogger, Platform, Storage } from '@launchdarkly/js-client-sdk-common';

import PlatformCrypto from './crypto';
import PlatformEncoding from './PlatformEncoding';
import PlatformInfo from './PlatformInfo';
import PlatformRequests from './PlatformRequests';
import PlatformStorage from './PlatformStorage';

const createPlatform = (logger: LDLogger, storage?: Storage): Platform => ({
  crypto: new PlatformCrypto(),
  info: new PlatformInfo(logger),
  requests: new PlatformRequests(logger),
  encoding: new PlatformEncoding(),
  storage: storage ?? new PlatformStorage(logger),
});

export default createPlatform;
