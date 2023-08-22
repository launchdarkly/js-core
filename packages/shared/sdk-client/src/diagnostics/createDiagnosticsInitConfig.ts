import Configuration from '../configuration';

const createDiagnosticsInitConfig = (config: Configuration) => ({
  // TODO: figure out default values
  // customBaseURI: config.baseUrl !== defaultValues.baseUri,
  // customStreamURI: config.streamUrl !== baseOptionDefs.streamUrl.default,
  // customEventsURI: config.eventsUrl !== baseOptionDefs.eventsUrl.default,
  eventsCapacity: config.eventCapacity,
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
