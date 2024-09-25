import { secondsToMillis } from '@launchdarkly/js-sdk-common';

import { ConfigurationImpl } from '../../src/configuration';
import createDiagnosticsInitConfig, {
  type DiagnosticsInitConfig,
} from '../../src/diagnostics/createDiagnosticsInitConfig';

describe('createDiagnosticsInitConfig', () => {
  let initConfig: DiagnosticsInitConfig;

  beforeEach(() => {
    initConfig = createDiagnosticsInitConfig(new ConfigurationImpl());
  });

  test('defaults', () => {
    expect(initConfig).toEqual({
      allAttributesPrivate: false,
      bootstrapMode: false,
      customBaseURI: false,
      customEventsURI: false,
      customStreamURI: false,
      diagnosticRecordingIntervalMillis: secondsToMillis(900),
      eventsCapacity: 100,
      eventsFlushIntervalMillis: secondsToMillis(30),
      reconnectTimeMillis: secondsToMillis(1),
      usingSecureMode: false,
    });
  });

  test('non-default config', () => {
    const custom = createDiagnosticsInitConfig(
      new ConfigurationImpl({
        baseUri: 'https://dev.ld.com',
        streamUri: 'https://stream.ld.com',
        eventsUri: 'https://events.ld.com',
        capacity: 1,
        flushInterval: 30,
        streamInitialReconnectDelay: 3,
        diagnosticRecordingInterval: 4,
        allAttributesPrivate: true,
        // TODO: test Configuration hash and bootstrap
        // hash: 'test-hash',
        // bootstrap: { testFlag: true },
      }),
    );
    expect(custom).toEqual({
      allAttributesPrivate: true,
      bootstrapMode: false,
      customBaseURI: true,
      customEventsURI: true,
      customStreamURI: true,
      diagnosticRecordingIntervalMillis: 4000,
      eventsCapacity: 1,
      eventsFlushIntervalMillis: 30000,
      reconnectTimeMillis: 3000,
      usingSecureMode: false,
    });
  });
});
