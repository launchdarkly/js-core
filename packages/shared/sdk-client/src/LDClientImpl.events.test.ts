import { AutoEnvAttributes, clone, LDContext } from '@launchdarkly/js-sdk-common';
import { InputCustomEvent, InputIdentifyEvent } from '@launchdarkly/js-sdk-common/dist/internal';
import {
  basicPlatform,
  logger,
  MockEventProcessor,
  setupMockEventProcessor,
  setupMockStreamingProcessor,
} from '@launchdarkly/private-js-mocks';

import * as mockResponseJson from './evaluation/mockResponse.json';
import LDClientImpl from './LDClientImpl';
import { Flags } from './types';

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
const carContext: LDContext = { kind: 'car', key: 'test-car' };

describe('sdk-client object', () => {
  beforeEach(() => {
    defaultPutResponse = clone<Flags>(mockResponseJson);
    setupMockEventProcessor();
    setupMockStreamingProcessor(false, defaultPutResponse);
    basicPlatform.crypto.randomUUID.mockReturnValue('random1');

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

  it('produces track events with data', async () => {
    await ldc.identify(carContext);

    ldc.track('the-event', { the: 'data' }, undefined);
    expect(MockEventProcessor).toHaveBeenCalled();
    expect(ldc.eventProcessor!.sendEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining<InputCustomEvent>({
        kind: 'custom',
        key: 'the-event',
        context: expect.objectContaining({
          contexts: expect.objectContaining({
            car: { key: 'test-car' },
          }),
        }),
        data: { the: 'data' },
        samplingRatio: 1,
        creationDate: expect.any(Number),
      }),
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('produces track events with a metric value', async () => {
    await ldc.identify(carContext);

    ldc.track('the-event', undefined, 12);
    expect(MockEventProcessor).toHaveBeenCalled();
    expect(ldc.eventProcessor!.sendEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining<InputCustomEvent>({
        kind: 'custom',
        key: 'the-event',
        context: expect.objectContaining({
          contexts: expect.objectContaining({
            car: { key: 'test-car' },
          }),
        }),
        metricValue: 12,
        samplingRatio: 1,
        creationDate: expect.any(Number),
      }),
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('produces track events with a metric value and data', async () => {
    await ldc.identify(carContext);

    ldc.track('the-event', { the: 'data' }, 12);
    expect(MockEventProcessor).toHaveBeenCalled();
    expect(ldc.eventProcessor!.sendEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining<InputCustomEvent>({
        kind: 'custom',
        key: 'the-event',
        context: expect.objectContaining({
          contexts: expect.objectContaining({
            car: { key: 'test-car' },
          }),
        }),
        metricValue: 12,
        data: { the: 'data' },
        samplingRatio: 1,
        creationDate: expect.any(Number),
      }),
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('produces a warning when the metric value is non-numeric', async () => {
    // @ts-ignore
    await ldc.identify(carContext);
    // @ts-ignore
    ldc.track('the-event', { the: 'data' }, '12');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/was called with a non-numeric/),
    );
  });
});
