import { BasicLogger, LDOptions } from '@launchdarkly/js-server-sdk-common';

export const defaultOptions: LDOptions = {
  stream: false,
  sendEvents: false,
  useLdd: true,
  diagnosticOptOut: true,
  logger: BasicLogger.get(),
};

const createOptions = (options: LDOptions) => ({ ...defaultOptions, ...options });

export default createOptions;
