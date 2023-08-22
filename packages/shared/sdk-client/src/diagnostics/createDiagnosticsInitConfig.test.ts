import Configuration from '../configuration';
import createDiagnosticsInitConfig from './createDiagnosticsInitConfig';

describe('createDiagnosticsInitConfig', () => {
  test('defaults', () => {
    const initConfig = createDiagnosticsInitConfig(new Configuration());
    expect(initConfig).toEqual({
      allAttributesPrivate: false,
      bootstrapMode: false,
      customBaseURI: false,
      customEventsURI: false,
      customStreamURI: false,
      diagnosticRecordingIntervalMillis: 900000,
      eventsCapacity: 100,
      eventsFlushIntervalMillis: 2000,
      fetchGoalsDisabled: false,
      reconnectTimeMillis: 1000,
      sendEventsOnlyForVariation: false,
      streamingDisabled: true,
      usingSecureMode: false,
    });
  });
});
