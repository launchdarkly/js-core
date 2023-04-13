import { EdgeConfigClient } from '@vercel/edge-config';
import { BasicLogger, LDLogger, LDOptions, SafeLogger } from '@launchdarkly/js-server-sdk-common';
import packageJson from '../../package.json';
import createFeatureStore from './createFeatureStore';

type SupportedLDOptions = Pick<LDOptions, 'logger' | 'featureStore'>;
const allowedOptions = ['logger', 'featureStore'];

const defaults = {
  stream: false,
  // TODO: Investigate if we can actually send events
  sendEvents: false,
  offline: false,
  useLdd: true,
  allAttributesPrivate: false,
  privateAttributes: [],
  contextKeysCapacity: 1000,
  contextKeysFlushInterval: 300,
  diagnosticOptOut: true,
  diagnosticRecordingInterval: 900,
  wrapperName: 'vercel',
  wrapperVersion: packageJson.version,
};

export const finalizeLogger = ({ logger }: SupportedLDOptions) => {
  const fallbackLogger = new BasicLogger({
    level: 'info',
    // eslint-disable-next-line no-console
    destination: console.error,
  });

  return logger ? new SafeLogger(logger, fallbackLogger) : fallbackLogger;
};

export const finalizeFeatureStore = (
  edgeConfig: EdgeConfigClient,
  sdkKey: string,
  { featureStore }: SupportedLDOptions,
  logger: LDLogger
) => featureStore ?? createFeatureStore(edgeConfig, sdkKey, logger);

const createOptions = (
  edgeConfig: EdgeConfigClient,
  sdkKey: string,
  options: SupportedLDOptions = {
    logger: undefined,
    featureStore: undefined,
  }
) => {
  if (!sdkKey) {
    throw new Error('You must configure the client with a client key');
  }

  if (!edgeConfig || typeof edgeConfig !== 'object' || !edgeConfig.get) {
    throw new Error('You must configure the client with an Edge Config SDK instance');
  }

  Object.entries(options).forEach(([key]) => {
    if (!allowedOptions.includes(key)) {
      throw new Error(`Configuration option: ${key} not supported`);
    }
  });

  const logger = finalizeLogger(options);
  const featureStore = finalizeFeatureStore(edgeConfig, sdkKey, options, logger);
  const finalOptions = { ...defaults, ...options, logger, featureStore };
  logger.debug(`Using LD options: ${JSON.stringify(finalOptions)}`);
  return finalOptions;
};

export default createOptions;
