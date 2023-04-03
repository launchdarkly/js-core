import { KVNamespace } from '@cloudflare/workers-types';
import { BasicLogger, LDOptions, SafeLogger } from '@launchdarkly/js-server-sdk-common';
import { version } from '../package.json';
import createFeatureStore from './featureStore';

const defaults = {
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
  wrapperName: 'cloudflare',
  wrapperVersion: version,
};

const allowedOptions = ['logger', 'featureStore'];

export const createConfig = (kvNamespace: KVNamespace, sdkKey: string, options: LDOptions = {}) => {
  if (!sdkKey) {
    throw new Error('You must configure the client with a client key');
  }

  if (!kvNamespace || typeof kvNamespace !== 'object' || !kvNamespace.get) {
    throw new Error('You must configure the client with a Cloudflare KV Store namespace binding');
  }

  Object.entries(options).forEach(([key]) => {
    if (!allowedOptions.includes(key)) {
      throw new Error(`Configuration option: ${key} not supported`);
    }
  });

  const fallbackLogger = new BasicLogger({
    level: 'info',
    // eslint-disable-next-line no-console
    destination: console.error,
  });
  const { featureStore, logger } = options;
  const finalLogger = logger ? new SafeLogger(logger, fallbackLogger) : fallbackLogger;
  const finalStore = featureStore ?? createFeatureStore(kvNamespace, sdkKey, finalLogger);
  const finalConfig = { ...defaults, ...options, logger: finalLogger, featureStore: finalStore };

  finalLogger.debug(`Using Configuration: ${JSON.stringify(finalConfig)}`);

  return finalConfig;
};

export default createConfig;
