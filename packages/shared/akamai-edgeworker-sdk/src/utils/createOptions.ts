// eslint-disable-next-line max-classes-per-file
import { BasicLogger, LDOptions } from '@launchdarkly/js-server-sdk-common';

export const defaultOptions: LDOptions = {
  stream: false,
  sendEvents: false,
  useLdd: true,
  diagnosticOptOut: true,
  logger: BasicLogger.get(),
};

export const createOptions = (options: LDOptions) => {
  const finalOptions = { ...defaultOptions, ...options };
  finalOptions.logger?.debug(`Using LD options: ${JSON.stringify(finalOptions)}`);
  return finalOptions;
};
