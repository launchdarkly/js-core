import { AutoEnvAttributes, clone, LDContext } from '@launchdarkly/js-sdk-common';
import { InputIdentifyEvent } from '@launchdarkly/js-sdk-common/dist/internal';
import {
  basicPlatform,
  hasher,
  logger,
  MockEventProcessor,
  setupMockEventProcessor,
  setupMockStreamingProcessor,
} from '@launchdarkly/private-js-mocks';

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
        EventProcessor: m.MockEventProcessor,
      },
    },
  };
});

const testSdkKey = 'test-sdk-key';
let ldc: LDClientImpl;
let defaultPutResponse: Flags;

describe('sdk-client object', () => {
  beforeEach(() => {
    defaultPutResponse = clone<Flags>(mockResponseJson);
    setupMockEventProcessor();
    setupMockStreamingProcessor(false, defaultPutResponse);
    basicPlatform.crypto.randomUUID.mockReturnValue('random1');
    hasher.digest.mockReturnValue('digested1');

    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Enabled, basicPlatform, {
      logger,
    });
    jest
      .spyOn(LDClientImpl.prototype as any, 'createStreamUriPath')
      .mockReturnValue('/stream/path');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('identify event', async () => {
    defaultPutResponse['dev-test-flag'].value = false;
    const carContext: LDContext = { kind: 'car', key: 'test-car' };

    await ldc.identify(carContext);

    expect(MockEventProcessor).toHaveBeenCalled();
    expect(ldc.eventProcessor!.sendEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining<InputIdentifyEvent>({
        kind: 'identify',
        context: expect.objectContaining({
          contexts: expect.objectContaining({
            car: { key: 'test-car' },
          }),
        }),
        creationDate: expect.any(Number),
        samplingRatio: expect.any(Number),
      }),
    );
  });
});
