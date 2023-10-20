// eslint-disable-next-line import/no-extraneous-dependencies
import EventTarget from 'event-target-shim';

import { LDClientImpl, type LDOptions } from '@launchdarkly/js-client-sdk-common';
import type { LDContext } from '@launchdarkly/js-sdk-common';

import platform from './platform';

if (!global.EventTarget) {
  // @ts-ignore
  global.EventTarget = EventTarget;
}

const init = async (sdkKey: string, context: LDContext, options: LDOptions = {}) => {
  const ldc = new LDClientImpl(sdkKey, context, platform, options);
  await ldc.start();
  return ldc;
};

export * from '@launchdarkly/js-client-sdk-common';
export default init;
