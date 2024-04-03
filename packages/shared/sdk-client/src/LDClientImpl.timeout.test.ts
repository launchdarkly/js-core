import { AutoEnvAttributes, clone, LDContext } from '@launchdarkly/js-sdk-common';
import { basicPlatform, logger, setupMockStreamingProcessor } from '@launchdarkly/private-js-mocks';

import * as mockResponseJson from './evaluation/mockResponse.json';
import LDClientImpl from './LDClientImpl';
import { Flags } from './types';
import { toMulti } from './utils/addAutoEnv';

jest.mock('@launchdarkly/js-sdk-common', () => {
  const actual = jest.requireActual('@launchdarkly/js-sdk-common');
  const m = jest.requireActual('@launchdarkly/private-js-mocks');
  return {
    ...actual,
    ...{
      internal: {
        ...actual.internal,
        StreamingProcessor: m.MockStreamingProcessor,
      },
    },
  };
});

const testSdkKey = 'test-sdk-key';
let ldc: LDClientImpl;
let defaultPutResponse: Flags;

describe('sdk-client identify timeout', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    defaultPutResponse = clone<Flags>(mockResponseJson);

    // simulate streamer error after a long timeout
    setupMockStreamingProcessor(true, defaultPutResponse, undefined, undefined, 30);

    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Enabled, basicPlatform, {
      logger,
      sendEvents: false,
    });
    jest
      .spyOn(LDClientImpl.prototype as any, 'createStreamUriPath')
      .mockReturnValue('/stream/path');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('rejects with default timeout of 15s', async () => {
    const carContext: LDContext = { kind: 'car', key: 'test-car' };
    jest.advanceTimersByTimeAsync(15000).then();
    await expect(ldc.identify(carContext)).rejects.toThrow(/identify timed out/);
  });

  test('rejects with custom timeout', async () => {
    const timeoutSeconds = 5;
    const carContext: LDContext = { kind: 'car', key: 'test-car' };

    jest.advanceTimersByTimeAsync(timeoutSeconds * 1000).then();

    await expect(ldc.identify(carContext, { timeoutSeconds })).rejects.toThrow(
      /identify timed out/,
    );
  });

  test('resolves with default timeout', async () => {
    const carContext: LDContext = { kind: 'car', key: 'test-car' };
    setupMockStreamingProcessor(false, defaultPutResponse, undefined, undefined);
    jest.advanceTimersByTimeAsync(15 * 1000).then();

    await expect(ldc.identify(carContext)).resolves.toBeUndefined();

    expect(ldc.getContext()).toEqual(expect.objectContaining(toMulti(carContext)));
    expect(ldc.allFlags()).toEqual({
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

  test('resolves with custom timeout', async () => {
    const timeoutSeconds = 5;
    const carContext: LDContext = { kind: 'car', key: 'test-car' };
    setupMockStreamingProcessor(false, defaultPutResponse, undefined, undefined);
    jest.advanceTimersByTimeAsync(timeoutSeconds).then();

    await expect(ldc.identify(carContext, { timeoutSeconds })).resolves.toBeUndefined();

    expect(ldc.getContext()).toEqual(expect.objectContaining(toMulti(carContext)));
    expect(ldc.allFlags()).toEqual({
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
});
