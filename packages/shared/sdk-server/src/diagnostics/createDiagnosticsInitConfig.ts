import { Platform, secondsToMillis } from '@launchdarkly/js-sdk-common';

import {
  isPollingOnlyOptions,
  isStandardOptions,
  isStreamingOnlyOptions,
  LDFeatureStore,
} from '../api';
import Configuration, { defaultValues } from '../options/Configuration';

const createDiagnosticsInitConfig = (
  config: Configuration,
  platform: Platform,
  featureStore: LDFeatureStore,
) => {
  let pollingIntervalMillis: number | undefined;
  if (config.dataSystem?.dataSource) {
    if (
      (isStandardOptions(config.dataSystem.dataSource) ||
        isPollingOnlyOptions(config.dataSystem.dataSource)) &&
      config.dataSystem.dataSource.pollInterval
    ) {
      pollingIntervalMillis = secondsToMillis(config.dataSystem.dataSource.pollInterval);
    }
  } else {
    pollingIntervalMillis = secondsToMillis(config.pollInterval);
  }

  let reconnectTimeMillis: number | undefined;
  if (config.dataSystem?.dataSource) {
    if (
      (isStandardOptions(config.dataSystem.dataSource) ||
        isStreamingOnlyOptions(config.dataSystem.dataSource)) &&
      config.dataSystem.dataSource.streamInitialReconnectDelay
    ) {
      reconnectTimeMillis = secondsToMillis(
        config.dataSystem.dataSource.streamInitialReconnectDelay,
      );
    }
  } else {
    reconnectTimeMillis = secondsToMillis(config.streamInitialReconnectDelay);
  }

  let streamDisabled: boolean;
  if (config.dataSystem?.dataSource) {
    streamDisabled = isPollingOnlyOptions(config.dataSystem?.dataSource);
  } else {
    streamDisabled = !config.stream;
  }

  return {
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
    ...(pollingIntervalMillis ? { pollingIntervalMillis } : null),
    // include reconnect delay if data source config has it
    ...(reconnectTimeMillis ? { reconnectTimeMillis } : null),
    contextKeysFlushIntervalMillis: secondsToMillis(config.contextKeysFlushInterval),
    diagnosticRecordingIntervalMillis: secondsToMillis(config.diagnosticRecordingInterval),
    streamingDisabled: streamDisabled,
    usingRelayDaemon: config.dataSystem?.useLdd ?? config.useLdd,
    offline: config.offline,
    allAttributesPrivate: config.allAttributesPrivate,
    contextKeysCapacity: config.contextKeysCapacity,

    usingProxy: !!platform.requests.usingProxy?.(),
    usingProxyAuthenticator: !!platform.requests.usingProxyAuth?.(),
    dataStoreType: featureStore.getDescription?.() ?? 'memory',
  };
};

export default createDiagnosticsInitConfig;
