import { BasicLogger, LDOptions } from '@launchdarkly/js-server-sdk-common';

export const defaultOptions: LDOptions = {
  stream: false,
  sendEvents: true,
  useLdd: true,
  diagnosticOptOut: true,
  logger: BasicLogger.get(),
};

const createOptions = (options: LDOptions) => {
  const finalOptions = { ...defaultOptions, ...options };
  finalOptions.logger?.debug(`Using LD options: ${JSON.stringify(finalOptions)}`);
  return finalOptions;
};

export default createOptions;
