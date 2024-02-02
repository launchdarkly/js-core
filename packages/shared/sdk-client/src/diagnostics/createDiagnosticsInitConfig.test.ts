import { secondsToMillis } from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';
import createDiagnosticsInitConfig, {
  type DiagnosticsInitConfig,
} from './createDiagnosticsInitConfig';

describe('createDiagnosticsInitConfig', () => {
  let initConfig: DiagnosticsInitConfig;

  beforeEach(() => {
    initConfig = createDiagnosticsInitConfig(new Configuration());
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
      eventsFlushIntervalMillis: secondsToMillis(2),
      reconnectTimeMillis: secondsToMillis(1),
      usingSecureMode: false,
    });
  });

  test('non-default config', () => {
    const custom = createDiagnosticsInitConfig(
      new Configuration({
        baseUri: 'https://dev.ld.com',
        streamUri: 'https://stream.ld.com',
        eventsUri: 'https://events.ld.com',
        capacity: 1,
        flushInterval: 2,
        streamInitialReconnectDelay: 3,
        diagnosticRecordingInterval: 4,
        allAttributesPrivate: true,
        hash: 'test-hash',
        bootstrap: { testFlag: true },
      }),
    );
    expect(custom).toEqual({
      allAttributesPrivate: true,
      bootstrapMode: true,
      customBaseURI: true,
      customEventsURI: true,
      customStreamURI: true,
      diagnosticRecordingIntervalMillis: 4000,
      eventsCapacity: 1,
      eventsFlushIntervalMillis: 2000,
      reconnectTimeMillis: 3000,
      usingSecureMode: true,
    });
  });
});
