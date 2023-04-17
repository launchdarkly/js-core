import { BasicLogger, LDFeatureStore } from '@launchdarkly/js-server-sdk-common';

const defaults = {
  stream: false,
  sendEvents: true,
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

const createOptions = (sdkKey: string, featureStore: LDFeatureStore) => {
  if (!sdkKey) {
    throw new Error('You must configure the client with a client key');
  }

  if (!featureStore || typeof featureStore !== 'object' || !featureStore.get) {
    throw new Error('You must configure the client with a feature store');
  }

  const finalOptions = { ...defaults, featureStore };
  defaults.logger.debug(`Using LD options: ${JSON.stringify(finalOptions)}`);
  return finalOptions;
};

export default createOptions;
