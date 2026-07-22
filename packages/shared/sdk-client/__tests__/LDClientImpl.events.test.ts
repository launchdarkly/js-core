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
import mockResponseJson from './evaluation/mockResponse.json';
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

  describe('prerequisite cycles', () => {
    // Cycle-detection tests exercise the ancestor-set cycle guard added to _variationInternal.
    // Prior to that guard, any of these flag configurations would cause unbounded recursion during
    // a variation() call. Each test constructs a cyclic prereq graph, drives it through identify(),
    // evaluates one flag on the cycle, and asserts (a) the returned value equals the cached value
    // and (b) the emitted feature events match exactly one recording per cycle-safe descent.
    //
    // The outer `beforeEach` captures a JSON snapshot of `defaultPutResponse` inside the stream mock,
    // so mutations here would not otherwise propagate to the SDK's flag store. `installCycleFlags`
    // both mutates `defaultPutResponse` and rebuilds the mock so the SDK loads the updated set on
    // the next identify().
    const makeFlag = (
      prerequisites?: string[],
    ): {
      value: boolean;
      variation: number;
      version: number;
      reason: { kind: string };
      trackEvents: boolean;
      prerequisites?: string[];
    } => ({
      value: true,
      variation: 0,
      version: 1,
      reason: { kind: 'FALLTHROUGH' },
      trackEvents: true,
      ...(prerequisites ? { prerequisites } : {}),
    });
    const installCycleFlags = (flags: Flags) => {
      Object.assign(defaultPutResponse, flags);
      mockPlatform.requests.createEventSource.mockImplementation(
        (streamUri: string = '', options: any = {}) => {
          mockEventSource = new MockEventSource(streamUri, options);
          mockEventSource.simulateEvents('put', [{ data: JSON.stringify(defaultPutResponse) }]);
          return mockEventSource;
        },
      );
    };
    const featureEventKeysAfterIdentify = () =>
      mockedSendEvent.mock.calls
        .map((call) => call[0])
        .filter((event) => event.kind === 'feature')
        .map((event) => event.key);

    it('skips a self-loop prerequisite and returns the cached value', async () => {
      installCycleFlags({ flagA: makeFlag(['flagA']) } as unknown as Flags);
      await ldc.identify({ kind: 'user', key: 'bob' });
      expect(ldc.variation('flagA', false)).toBe(true);
      // Only flagA emits a feature event; the self-prereq is cycle-skipped.
      expect(featureEventKeysAfterIdentify()).toEqual(['flagA']);
    });

    it('handles a two-cycle evaluating A', async () => {
      installCycleFlags({
        flagA: makeFlag(['flagB']),
        flagB: makeFlag(['flagA']),
      } as unknown as Flags);
      await ldc.identify({ kind: 'user', key: 'bob' });
      expect(ldc.variation('flagA', false)).toBe(true);
      // A -> B -> [A skipped]. Events (deepest-first): B (as prereq of A), then A.
      expect(featureEventKeysAfterIdentify()).toEqual(['flagB', 'flagA']);
    });

    it('handles a two-cycle evaluating B', async () => {
      installCycleFlags({
        flagA: makeFlag(['flagB']),
        flagB: makeFlag(['flagA']),
      } as unknown as Flags);
      await ldc.identify({ kind: 'user', key: 'bob' });
      expect(ldc.variation('flagB', false)).toBe(true);
      // Symmetric: same graph, entry from B. Events: A (as prereq of B), then B.
      expect(featureEventKeysAfterIdentify()).toEqual(['flagA', 'flagB']);
    });

    it('handles a three-cycle', async () => {
      installCycleFlags({
        flagA: makeFlag(['flagB']),
        flagB: makeFlag(['flagC']),
        flagC: makeFlag(['flagA']),
      } as unknown as Flags);
      await ldc.identify({ kind: 'user', key: 'bob' });
      expect(ldc.variation('flagA', false)).toBe(true);
      // A -> B -> C -> [A skipped]. Events emitted deepest-first: C, B, A.
      expect(featureEventKeysAfterIdentify()).toEqual(['flagC', 'flagB', 'flagA']);
    });

    it('emits the shared descendant once per path in a non-cyclic diamond', async () => {
      // Diamond: A -> [B, C], B -> [D], C -> [D]. Not a cycle. Ancestor-set (current-path) semantics
      // must let D be reached on each of the two independent paths -- so D emits twice. A naive
      // "visited across the whole walk" implementation would drop the second D event; this case
      // guards against that regression.
      installCycleFlags({
        flagA: makeFlag(['flagB', 'flagC']),
        flagB: makeFlag(['flagD']),
        flagC: makeFlag(['flagD']),
        flagD: makeFlag(),
      } as unknown as Flags);
      await ldc.identify({ kind: 'user', key: 'bob' });
      expect(ldc.variation('flagA', false)).toBe(true);
      // Events (deepest-first per path): D (via B), B, D (via C), C, A. D appears twice.
      expect(featureEventKeysAfterIdentify()).toEqual(['flagD', 'flagB', 'flagD', 'flagC', 'flagA']);
    });
  });
});
