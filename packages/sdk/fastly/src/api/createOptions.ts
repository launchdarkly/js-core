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

  // The Fastly SDK does not poll LaunchDarkly for updates, so a custom baseUri does not make sense. However, we need
  // to set it to something when a custom eventsUri is specified in order to pass validation in sdk-server-common.
  if (finalOptions.eventsUri) {
    finalOptions.baseUri = finalOptions.eventsUri;
  }
  return finalOptions;
};

export default createOptions;
