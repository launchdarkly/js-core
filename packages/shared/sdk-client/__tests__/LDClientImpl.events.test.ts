import {
  AutoEnvAttributes,
  ClientContext,
  clone,
  internal,
  LDContext,
  LDLogger,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import LDClientImpl from '../src/LDClientImpl';
import { Flags } from '../src/types';
import { createBasicPlatform } from './createBasicPlatform';
import * as mockResponseJson from './evaluation/mockResponse.json';
import { MockEventProcessor } from './eventProcessor';
import { MockEventSource } from './streaming/LDClientImpl.mocks';
import { makeTestDataManagerFactory } from './TestDataManager';

type InputCustomEvent = internal.InputCustomEvent;
type InputIdentifyEvent = internal.InputIdentifyEvent;

let mockPlatform: ReturnType<typeof createBasicPlatform>;
let logger: LDLogger;

beforeEach(() => {
  mockPlatform = createBasicPlatform();
  logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
});

jest.mock('@launchdarkly/js-sdk-common', () => {
  const actual = jest.requireActual('@launchdarkly/js-sdk-common');
  const m = jest.requireActual('./eventProcessor');
  return {
    ...actual,
    ...{
      internal: {
        ...actual.internal,
        EventProcessor: m.MockEventProcessor,
      },
    },
  };
});

const testSdkKey = 'test-sdk-key';
let ldc: LDClientImpl;
let mockEventSource: MockEventSource;
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

    const simulatedEvents = [{ data: JSON.stringify(defaultPutResponse) }];
    mockPlatform.storage.get.mockImplementation(() => undefined);
    mockPlatform.requests.createEventSource.mockImplementation(
      (streamUri: string = '', options: any = {}) => {
        mockEventSource = new MockEventSource(streamUri, options);
        mockEventSource.simulateEvents('put', simulatedEvents);
        return mockEventSource;
      },
    );

    mockPlatform.crypto.randomUUID.mockReturnValue('random1');

    ldc = new LDClientImpl(
      testSdkKey,
      AutoEnvAttributes.Enabled,
      mockPlatform,
      {
        logger,
      },
      makeTestDataManagerFactory(testSdkKey, mockPlatform),
    );
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
          _contexts: expect.objectContaining({
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
          _contexts: expect.objectContaining({
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
          _contexts: expect.objectContaining({
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
          _contexts: expect.objectContaining({
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

  it('sends events for prerequisite flags', async () => {
    await ldc.identify({ kind: 'user', key: 'bob' });
    ldc.variation('has-prereq-depth-1', false);
    ldc.flush();

    // Prerequisite evaluation event should be emitted before the evaluation event for the flag
    // being evaluated.
    expect(mockedSendEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        context: expect.anything(),
        creationDate: expect.any(Number),
        default: undefined,
        key: 'is-prereq',
        kind: 'feature',
        samplingRatio: 1,
        trackEvents: true,
        value: true,
        variation: 0,
        version: 1,
        withReasons: false,
      }),
    );
    expect(mockedSendEvent).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        context: expect.anything(),
        creationDate: expect.any(Number),
        default: false,
        key: 'has-prereq-depth-1',
        kind: 'feature',
        samplingRatio: 1,
        trackEvents: true,
        value: true,
        variation: 0,
        version: 4,
        withReasons: false,
      }),
    );
  });
});
