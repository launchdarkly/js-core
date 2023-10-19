import { LDClientImpl, type LDOptions } from '@launchdarkly/js-client-sdk-common';
import type { LDContext, Platform } from '@launchdarkly/js-sdk-common';

export function multiply(a: number, b: number): Promise<number> {
  return Promise.resolve(a * b);
}

const init = async (sdkKey: string, context: LDContext, platform: Platform, options: LDOptions) => {
  const ldc = new LDClientImpl(sdkKey, context, platform, options);
  return ldc.start();
};

export default init;
