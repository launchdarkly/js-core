import { secondsToMillis, ServiceEndpoints } from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';

export type DiagnosticsInitConfig = {
  // dom & server common properties
  customBaseURI: boolean;
  customStreamURI: boolean;
  customEventsURI: boolean;
  eventsCapacity: number;
  eventsFlushIntervalMillis: number;
  reconnectTimeMillis: number;
  diagnosticRecordingIntervalMillis: number;
  streamingDisabled: boolean;
  allAttributesPrivate: boolean;

  // dom specific properties
  usingSecureMode: boolean;
  bootstrapMode: boolean;
};
const createDiagnosticsInitConfig = (config: Configuration): DiagnosticsInitConfig => ({
  customBaseURI: config.baseUri !== ServiceEndpoints.DEFAULT_POLLING,
  customStreamURI: config.streamUri !== Configuration.DEFAULT_STREAM,
  customEventsURI: config.eventsUri !== ServiceEndpoints.DEFAULT_EVENTS,
  eventsCapacity: config.capacity,
  eventsFlushIntervalMillis: secondsToMillis(config.flushInterval),
  reconnectTimeMillis: secondsToMillis(config.streamReconnectDelay),
  diagnosticRecordingIntervalMillis: secondsToMillis(config.diagnosticRecordingInterval),
  streamingDisabled: !config.stream,
  allAttributesPrivate: config.allAttributesPrivate,
  usingSecureMode: !!config.hash,
  bootstrapMode: !!config.bootstrap,
});

export default createDiagnosticsInitConfig;
