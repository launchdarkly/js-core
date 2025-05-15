import { LDLogger, Platform, Storage } from '@launchdarkly/js-client-sdk-common';

import RNOptions from '../RNOptions';
import PlatformCrypto from './crypto';
import PlatformEncoding from './PlatformEncoding';
import PlatformInfo from './PlatformInfo';
import PlatformRequests from './PlatformRequests';
import PlatformStorage from './PlatformStorage';

const createPlatform = (logger: LDLogger, options: RNOptions, storage?: Storage): Platform => ({
  crypto: new PlatformCrypto(),
  info: new PlatformInfo(logger, options),
  requests: new PlatformRequests(logger),
  encoding: new PlatformEncoding(),
  storage: storage ?? new PlatformStorage(logger),
});

export default createPlatform;
