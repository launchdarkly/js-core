import { LDClientImpl, LDContext, LDOptions } from '@launchdarkly/js-client-sdk-common';

import platform from './platform';

const init = async (sdkKey: string, context: LDContext, options: LDOptions = {}) => {
  const ldc = new LDClientImpl(sdkKey, context, platform, options);
  await ldc.start();
  return ldc;
};

export default init;
