// eslint-disable-next-line max-classes-per-file
import {
  LDClientImpl,
  LDOptions,
  BasicLogger,
  SafeLogger,
} from '@launchdarkly/js-server-sdk-common';
import createPlatformInfo from './createPlatformInfo';
import EdgePlatform from './platform';

export default class AkamaiClient extends LDClientImpl {
  constructor(sdkKey: string, options: LDOptions) {
    super(sdkKey, new EdgePlatform(createPlatformInfo()), options, {
      onError: (err: Error) => {},
      onFailed: (err: Error) => {},
      onReady: () => {},
      onUpdate: (key: string) => {},
      hasEventListeners: () => {
        return false;
      },
    });
  }
}
