import { LDContext } from '@launchdarkly/js-sdk-common';
import { basicPlatform } from '@launchdarkly/private-js-mocks';

import fetchFlags from './evaluation/fetchFlags';
import * as mockResponseJson from './evaluation/mockResponse.json';
import LDClientImpl from './LDClientImpl';

jest.mock('./evaluation/fetchFlags', () => {
  const actual = jest.requireActual('./evaluation/fetchFlags');
  return {
    __esModule: true,
    ...actual,
    default: jest.fn(),
  };
});

describe('sdk-client object', () => {
  const testSdkKey = 'test-sdk-key';
  const context: LDContext = { kind: 'org', key: 'Testy Pizza' };
  const mockFetchFlags = fetchFlags as jest.Mock;

  let ldc: LDClientImpl;

  beforeEach(async () => {
    mockFetchFlags.mockResolvedValue(mockResponseJson);

    ldc = new LDClientImpl(testSdkKey, context, basicPlatform, {});
    await ldc.start();
  });

  test('instantiate with blank options', () => {
    expect(ldc.config).toMatchObject({
      allAttributesPrivate: false,
      baseUri: 'https://sdk.launchdarkly.com',
      capacity: 100,
      diagnosticOptOut: false,
      diagnosticRecordingInterval: 900,
      eventsUri: 'https://events.launchdarkly.com',
      flushInterval: 2,
      inspectors: [],
      logger: {
        destination: expect.any(Function),
        formatter: expect.any(Function),
        logLevel: 1,
        name: 'LaunchDarkly',
      },
      privateAttributes: [],
      sendEvents: true,
      sendLDHeaders: true,
      serviceEndpoints: {
        events: 'https://events.launchdarkly.com',
        polling: 'https://sdk.launchdarkly.com',
        streaming: 'https://clientstream.launchdarkly.com',
      },
      streamInitialReconnectDelay: 1,
      streamUri: 'https://clientstream.launchdarkly.com',
      tags: {},
      useReport: false,
      withReasons: false,
    });
  });

  test('all flags', async () => {
    const all = ldc.allFlags();

    expect(all).toEqual({
      'dev-test-flag': true,
      'easter-i-tunes-special': false,
      'easter-specials': 'no specials',
      fdsafdsafdsafdsa: true,
      'log-level': 'warn',
      'moonshot-demo': true,
      test1: 's1',
      'this-is-a-test': true,
    });
  });

  test('variation', async () => {
    const devTestFlag = ldc.variation('dev-test-flag');

    expect(devTestFlag).toBe(true);
  });
});
