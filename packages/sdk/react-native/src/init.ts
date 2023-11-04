import { LDClientImpl, LDContext, LDOptions } from '@launchdarkly/js-client-sdk-common';

import platform from './platform';

const init = async (sdkKey: string, context: LDContext, options: LDOptions = {}) => {
  const ldc = new LDClientImpl(sdkKey, platform, options);
  await ldc.identify(context);
  return ldc;
};

export default init;
