import {
  AutoEnvAttributes,
  ClientContext,
  clone,
  Encoding,
  internal,
  LDContext,
  subsystem,
} from '@launchdarkly/js-sdk-common';
import {
  createBasicPlatform,
  createLogger,
  MockEventProcessor,
} from '@launchdarkly/private-js-mocks';

import LDClientImpl from '../src/LDClientImpl';
import { MockEventSource } from '../src/LDClientImpl.mocks';
import { Flags } from '../src/types';
import * as mockResponseJson from './evaluation/mockResponse.json';

type InputCustomEvent = internal.InputCustomEvent;
type InputIdentifyEvent = internal.InputIdentifyEvent;

let mockPlatform: ReturnType<typeof createBasicPlatform>;
let logger: ReturnType<typeof createLogger>;

beforeEach(() => {
  mockPlatform = createBasicPlatform();
  logger = createLogger();
});

jest.mock('@launchdarkly/js-sdk-common', () => {
  const actual = jest.requireActual('@launchdarkly/js-sdk-common');
  const m = jest.requireActual('@launchdarkly/private-js-mocks');
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

    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Enabled, mockPlatform, {
      logger,
    });

    jest.spyOn(LDClientImpl.prototype as any, 'getStreamingPaths').mockReturnValue({
      pathGet(_encoding: Encoding, _credential: string, _plainContextString: string): string {
        return '/stream/path';
      },
      pathReport(_encoding: Encoding, _credential: string, _plainContextString: string): string {
        return '/stream/path';
      },
    });
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
