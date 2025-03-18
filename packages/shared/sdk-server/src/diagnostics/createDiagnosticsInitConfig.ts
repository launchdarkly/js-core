import { Platform, secondsToMillis } from '@launchdarkly/js-sdk-common';

import { isPollingOptions, isStandardOptions, isStreamingOptions, LDFeatureStore } from '../api';
import Configuration, { defaultValues } from '../options/Configuration';

const createDiagnosticsInitConfig = (
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
  // include polling interval if data source config has it
  ...((isStandardOptions(config.dataSystem.dataSource) ||
    isPollingOptions(config.dataSystem.dataSource)) &&
  config.dataSystem.dataSource.pollInterval
    ? { pollingIntervalMillis: config.dataSystem.dataSource.pollInterval }
    : null),
  // include reconnect delay if data source config has it
  ...((isStandardOptions(config.dataSystem.dataSource) ||
    isStreamingOptions(config.dataSystem.dataSource)) &&
  config.dataSystem.dataSource.streamInitialReconnectDelay
    ? { reconnectTimeMillis: config.dataSystem.dataSource.streamInitialReconnectDelay }
    : null),
  contextKeysFlushIntervalMillis: secondsToMillis(config.contextKeysFlushInterval),
  diagnosticRecordingIntervalMillis: secondsToMillis(config.diagnosticRecordingInterval),

  streamingDisabled: isPollingOptions(config.dataSystem.dataSource),
  usingRelayDaemon: config.useLdd,
  offline: config.offline,
  allAttributesPrivate: config.allAttributesPrivate,
  contextKeysCapacity: config.contextKeysCapacity,

  usingProxy: !!platform.requests.usingProxy?.(),
  usingProxyAuthenticator: !!platform.requests.usingProxyAuth?.(),
  dataStoreType: featureStore.getDescription?.() ?? 'memory',
});

export default createDiagnosticsInitConfig;
