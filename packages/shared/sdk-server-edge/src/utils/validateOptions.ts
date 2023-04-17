import { LDOptions as LDOptionsCommon } from '@launchdarkly/js-server-sdk-common/dist/api/options/LDOptions';

const validateOptions = (sdkKey: string, { featureStore, logger }: LDOptionsCommon) => {
  if (!sdkKey) {
    throw new Error('You must configure the client with a client key');
  }

  if (!featureStore || typeof featureStore !== 'object' || !featureStore.get) {
    throw new Error('You must configure the client with a feature store');
  }

  if (!logger) {
    throw new Error('You must configure the client with a logger');
  }
};

export default validateOptions;
