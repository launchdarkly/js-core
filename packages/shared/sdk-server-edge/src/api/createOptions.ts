import { BasicLogger, LDOptions } from '@launchdarkly/js-server-sdk-common';

export const defaultOptions: LDOptions = {
  stream: false,
  sendEvents: false,
  offline: false,
  useLdd: true,
  allAttributesPrivate: false,
  privateAttributes: [],
  contextKeysCapacity: 1000,
  contextKeysFlushInterval: 300,
  diagnosticOptOut: true,
  diagnosticRecordingInterval: 900,
  logger: BasicLogger.get(),
};

const createOptions = (options: LDOptions) => {
  const finalOptions = { ...defaultOptions, ...options };
  finalOptions.logger?.debug(`Using LD options: ${JSON.stringify(finalOptions)}`);
  return finalOptions;
};

export default createOptions;
