import { internal } from '@launchdarkly/js-sdk-common';

import { LDOptions } from '../api';
import Configuration from '../options/Configuration';
import createDiagnosticInitConfig from './createDiagnosticInitConfig';

const {
  mocks: { basicPlatform },
} = internal;

const mockFeatureStore = {
  getDescription: jest.fn(() => 'Mock Feature Store'),
};

describe.only.each([
  [
    {},
    {
      allAttributesPrivate: false,
      connectTimeoutMillis: 5000,
      customBaseURI: false,
      customEventsURI: false,
      customStreamURI: false,
      dataStoreType: 'Mock Feature Store',
      diagnosticRecordingIntervalMillis: 900000,
      eventsCapacity: 10000,
      eventsFlushIntervalMillis: 5000,
      offline: false,
      pollingIntervalMillis: 30000,
      reconnectTimeMillis: 1000,
      socketTimeoutMillis: 5000,
      streamingDisabled: false,
      contextKeysCapacity: 1000,
      contextKeysFlushIntervalMillis: 300000,
      usingProxy: false,
      usingProxyAuthenticator: false,
      usingRelayDaemon: false,
    },
  ],
  [
    { baseUri: 'http://other' },
    {
      customBaseURI: true,
      customEventsURI: false,
      customStreamURI: false,
    },
  ],
  [
    { eventsUri: 'http://other' },
    {
      customBaseURI: false,
      customEventsURI: true,
      customStreamURI: false,
    },
  ],
  [
    { streamUri: 'http://other' },
    {
      customBaseURI: false,
      customEventsURI: false,
      customStreamURI: true,
    },
  ],
  [{ allAttributesPrivate: true }, { allAttributesPrivate: true }],
  [{ timeout: 6 }, { connectTimeoutMillis: 6000, socketTimeoutMillis: 6000 }],
  [{ diagnosticRecordingInterval: 999 }, { diagnosticRecordingIntervalMillis: 999000 }],
  [{ capacity: 999 }, { eventsCapacity: 999 }],
  [{ flushInterval: 33 }, { eventsFlushIntervalMillis: 33000 }],
  [{ stream: false }, { streamingDisabled: true }],
  [{ streamInitialReconnectDelay: 33 }, { reconnectTimeMillis: 33000 }],
  [{ contextKeysCapacity: 111 }, { contextKeysCapacity: 111 }],
  [{ contextKeysFlushInterval: 33 }, { contextKeysFlushIntervalMillis: 33000 }],
  [{ useLdd: true }, { usingRelayDaemon: true }],
  [{ featureStore: undefined }, { dataStoreType: 'memory' }],
])('given diagnostics managers with different configurations', (optionsIn, configOut) => {
  let configuration: Configuration;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockImplementation(() => 7777);
    configuration = new Configuration(optionsIn as LDOptions);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('translates the configuration correctly', () => {
    const c = createDiagnosticInitConfig(configuration, basicPlatform, mockFeatureStore as any);

    expect(c).toMatchObject(configOut);
  });
});

// describe.each([true, false])('Given proxy and proxy auth=%p', (auth) => {
//   let manager: DiagnosticsManager;
//
//   beforeEach(() => {
//     jest.spyOn(Date, 'now').mockImplementation(() => 7777);
//     jest.spyOn(basicPlatform.requests, 'usingProxy').mockImplementation(() => true);
//     jest.spyOn(basicPlatform.requests, 'usingProxyAuth').mockImplementation(() => auth);
//     manager = new DiagnosticsManager('my-sdk-key', basicPlatform, {});
//   });
//
//   afterEach(() => {
//     jest.resetAllMocks();
//   });
//
//   it('it gets the proxy configuration from the basicPlatform', () => {
//     const event = manager.createInitEvent();
//     expect(event.configuration).toMatchObject({
//       usingProxy: true,
//       usingProxyAuthenticator: auth,
//     });
//   });
// });
