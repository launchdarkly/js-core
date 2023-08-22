import { ServiceEndpoints } from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';

const createDiagnosticsInitConfig = (config: Configuration) => ({
  customBaseURI: config.baseUri !== ServiceEndpoints.DEFAULT_POLLING,
  customStreamURI: config.streamUri !== Configuration.DEFAULT_STREAM,
  customEventsURI: config.eventsUri !== ServiceEndpoints.DEFAULT_EVENTS,
  eventsCapacity: config.capacity,
  eventsFlushIntervalMillis: config.flushInterval,
  reconnectTimeMillis: config.streamReconnectDelay,
  diagnosticRecordingIntervalMillis: config.diagnosticRecordingInterval,
  streamingDisabled: !config.stream,
  allAttributesPrivate: config.allAttributesPrivate,

  // The following extra properties are only provided by client-side JS SDKs:
  usingSecureMode: !!config.hash,
  bootstrapMode: !!config.bootstrap,
  fetchGoalsDisabled: !config.fetchGoals,
  sendEventsOnlyForVariation: config.sendEventsOnlyForVariation,
});

export default createDiagnosticsInitConfig;
