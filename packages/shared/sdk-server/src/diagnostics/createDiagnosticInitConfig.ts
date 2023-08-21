import { Platform, secondsToMillis } from '@launchdarkly/js-sdk-common';

import { LDFeatureStore } from '../api';
import Configuration, { defaultValues } from '../options/Configuration';

const createDiagnosticInitConfig = (
  config: Configuration,
  platform: Platform,
  featureStore: LDFeatureStore,
) => ({
  customBaseURI: config.serviceEndpoints.polling !== defaultValues.baseUri,
  customStreamURI: config.serviceEndpoints.streaming !== defaultValues.streamUri,
  customEventsURI: config.serviceEndpoints.events !== defaultValues.eventsUri,
  eventsCapacity: config.eventsCapacity,

  // Node doesn't distinguish between these two kinds of timeouts. It is unlikely other web
  // based implementations would be able to either.
  connectTimeoutMillis: secondsToMillis(config.timeout),
  socketTimeoutMillis: secondsToMillis(config.timeout),
  eventsFlushIntervalMillis: secondsToMillis(config.flushInterval),
  pollingIntervalMillis: secondsToMillis(config.pollInterval),
  reconnectTimeMillis: secondsToMillis(config.streamInitialReconnectDelay),
  contextKeysFlushIntervalMillis: secondsToMillis(config.contextKeysFlushInterval),
  diagnosticRecordingIntervalMillis: secondsToMillis(config.diagnosticRecordingInterval),

  streamingDisabled: !config.stream,
  usingRelayDaemon: config.useLdd,
  offline: config.offline,
  allAttributesPrivate: config.allAttributesPrivate,
  contextKeysCapacity: config.contextKeysCapacity,

  usingProxy: !!platform.requests.usingProxy?.(),
  usingProxyAuthenticator: !!platform.requests.usingProxyAuth?.(),
  dataStoreType: featureStore.getDescription?.() ?? 'memory',
});

export default createDiagnosticInitConfig;
