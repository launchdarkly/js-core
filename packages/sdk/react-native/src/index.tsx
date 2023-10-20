import { LDClientImpl, type LDOptions } from '@launchdarkly/js-client-sdk-common';
import type { LDContext } from '@launchdarkly/js-sdk-common';

import platform from './platform';

const init = async (sdkKey: string, context: LDContext, options: LDOptions = {}) => {
  const ldc = new LDClientImpl(sdkKey, context, platform, options);
  await ldc.start();
  return ldc;
};

export * from '@launchdarkly/js-client-sdk-common';
export default init;
