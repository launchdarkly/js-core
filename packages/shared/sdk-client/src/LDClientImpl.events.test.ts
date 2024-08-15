import {
  AutoEnvAttributes,
  ClientContext,
  clone,
  internal,
  LDContext,
  subsystem,
} from '@launchdarkly/js-sdk-common';
import { InputCustomEvent, InputIdentifyEvent } from '@launchdarkly/js-sdk-common/dist/internal';
import {
  createBasicPlatform,
  logger,
  MockEventProcessor,
  setupMockStreamingProcessor,
} from '@launchdarkly/private-js-mocks';

import * as mockResponseJson from './evaluation/mockResponse.json';
import LDClientImpl from './LDClientImpl';
import { Flags } from './types';

const mockPlatform = createBasicPlatform();

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
  const mockedSendEvent: jest.Mock = jest.fn();
  beforeEach(() => {
    defaultPutResponse = clone<Flags>(mockResponseJson);
    mockedSendEvent.mockReset();
    MockEventProcessor.mockImplementation(
      (
        _config: internal.EventProcessorOptions,
        _clientContext: ClientContext,
        _contextDeduplicator?: subsystem.LDContextDeduplicator,
        _diagnosticsManager?: internal.DiagnosticsManager,
        _start: boolean = true,
      ) => ({
        close: jest.fn(),
        flush: jest.fn(),
        sendEvent: mockedSendEvent,
      }),
    );
    setupMockStreamingProcessor(false, defaultPutResponse);
    mockPlatform.crypto.randomUUID.mockReturnValue('random1');

    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Enabled, mockPlatform, {
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
    expect(mockedSendEvent).toHaveBeenNthCalledWith(
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
    expect(mockedSendEvent).toHaveBeenNthCalledWith(
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
    expect(mockedSendEvent).toHaveBeenNthCalledWith(
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
    expect(mockedSendEvent).toHaveBeenNthCalledWith(
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
