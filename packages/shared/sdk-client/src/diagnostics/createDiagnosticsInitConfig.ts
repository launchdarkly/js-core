import { secondsToMillis, ServiceEndpoints } from '@launchdarkly/js-sdk-common';

import { Configuration, DEFAULT_POLLING, DEFAULT_STREAM } from '../configuration';

export type DiagnosticsInitConfig = {
  // client & server common properties
  customBaseURI: boolean;
  customStreamURI: boolean;
  customEventsURI: boolean;
  eventsCapacity: number;
  eventsFlushIntervalMillis: number;
  reconnectTimeMillis: number;
  diagnosticRecordingIntervalMillis: number;
  allAttributesPrivate: boolean;

  // client specific properties
  usingSecureMode: boolean;
  bootstrapMode: boolean;
};
const createDiagnosticsInitConfig = (config: Configuration): DiagnosticsInitConfig => ({
  customBaseURI: config.serviceEndpoints.polling !== DEFAULT_POLLING,
  customStreamURI: config.serviceEndpoints.streaming !== DEFAULT_STREAM,
  customEventsURI: config.serviceEndpoints.events !== ServiceEndpoints.DEFAULT_EVENTS,
  eventsCapacity: config.capacity,
  eventsFlushIntervalMillis: secondsToMillis(config.flushInterval),
  reconnectTimeMillis: secondsToMillis(config.streamInitialReconnectDelay),
  diagnosticRecordingIntervalMillis: secondsToMillis(config.diagnosticRecordingInterval),
  allAttributesPrivate: config.allAttributesPrivate,
  // TODO: Implement when corresponding features are implemented.
  usingSecureMode: false,
  bootstrapMode: false,
});

export default createDiagnosticsInitConfig;
