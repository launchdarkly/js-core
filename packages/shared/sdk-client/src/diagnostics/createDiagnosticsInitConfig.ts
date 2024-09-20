import { secondsToMillis, ServiceEndpoints } from '@launchdarkly/js-sdk-common';

import ConfigurationImpl from '../configuration';

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
const createDiagnosticsInitConfig = (config: ConfigurationImpl): DiagnosticsInitConfig => ({
  customBaseURI: config.baseUri !== ConfigurationImpl.DEFAULT_POLLING,
  customStreamURI: config.streamUri !== ConfigurationImpl.DEFAULT_STREAM,
  customEventsURI: config.eventsUri !== ServiceEndpoints.DEFAULT_EVENTS,
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
