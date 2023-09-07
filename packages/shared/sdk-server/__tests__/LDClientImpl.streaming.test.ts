import {
  defaultHeaders,
  EventSource,
  EventSourceInitDict,
  Info,
  internal,
  Options,
  PlatformData,
  Requests,
  Response,
  SdkData,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import { EventName, ProcessStreamResponse } from '../../api';
import { VoidFunction } from '../../utils';
import { basicPlatform, clientContext, logger } from '../mocks';

const sdkKey = 'my-sdk-key';
const {
  basicConfiguration: { serviceEndpoints, tags },
  platform: { info },
} = clientContext;
const event = {
  data: {
    flags: {
      flagkey: { key: 'flagkey', version: 1 },
    },
    segments: {
      segkey: { key: 'segkey', version: 2 },
    },
  },
};

describe('given a stream processor with mock event source', () => {
  let streamProcessor: subsystem.LDStreamProcessor;
  let diagnosticsManager: internal.DiagnosticsManager;
  let listeners: Map<EventName, ProcessStreamResponse>;
  let mockEventSource: any;
  let mockListener: ProcessStreamResponse;
  let mockErrorHandler: jest.Mock;
  let simulatePutEvent: (e?: any) => void;

  beforeEach(() => {
    mockErrorHandler = jest.fn();
    mockEventSource = { onclose: jest.fn(), addEventListener: jest.fn() };

    basicPlatform.requests = {
      createEventSource: jest.fn(() => mockEventSource),
    } as any;
    clientContext.basicConfiguration.logger = logger;

    listeners = new Map();
    mockListener = {
      deserializeData: jest.fn((data) => data),
      processJson: jest.fn(),
    };
    listeners.set('put', mockListener);
    listeners.set('patch', mockListener);

    diagnosticsManager = new internal.DiagnosticsManager(sdkKey, basicPlatform, {});
    streamProcessor = new internal.StreamingProcessor(
      sdkKey,
      clientContext,
      listeners,
      diagnosticsManager,
      mockErrorHandler,
    );

    simulatePutEvent = (e: any = event) => {
      mockEventSource.addEventListener.mock.calls[0][1](e);
    };

    streamProcessor.start();
  });

  it('uses expected uri', () => {
    expect(basicPlatform.requests.createEventSource).toBeCalledWith(
      `${serviceEndpoints.streaming}/all`,
      {
        errorFilter: expect.any(Function),
        headers: defaultHeaders(sdkKey, info, tags),
        initialRetryDelayMillis: 1000,
        readTimeoutMillis: 300000,
        retryResetIntervalMillis: 60000,
      },
    );
  });

  it('adds listeners', () => {
    expect(mockEventSource.addEventListener).toHaveBeenNthCalledWith(
      1,
      'put',
      expect.any(Function),
    );
    expect(mockEventSource.addEventListener).toHaveBeenNthCalledWith(
      2,
      'patch',
      expect.any(Function),
    );
  });

  it('executes listeners', () => {
    simulatePutEvent();
    const patchHandler = mockEventSource.addEventListener.mock.calls[1][1];
    patchHandler(event);

    expect(mockListener.deserializeData).toBeCalledTimes(2);
    expect(mockListener.processJson).toBeCalledTimes(2);
  });

  // it('causes flags and segments to be stored', async () => {
  //   streamProcessor.start();
  //   es.handlers.put({ data: JSON.stringify(event) });
  //
  //   const initialized = await asyncStore.initialized();
  //   expect(initialized).toBeTruthy();
  //   const f = await asyncStore.get(VersionedDataKinds.Features, 'flagkey');
  //   expect(f?.version).toEqual(1);
  //   const s = await asyncStore.get(VersionedDataKinds.Segments, 'segkey');
  //   expect(s?.version).toEqual(2);
  // });
  // it('calls initialization callback', async () => {
  //   const promise = promiseStart();
  //   es.handlers.put({ data: JSON.stringify(event) });
  //   expect(await promise).toBeUndefined();
  // });

  it('passes error to callback if json data is malformed', async () => {
    (mockListener.deserializeData as jest.Mock).mockReturnValue(false);
    simulatePutEvent();

    expect(logger.error).toBeCalledWith(expect.stringMatching(/invalid data in "put"/));
    expect(logger.debug).toBeCalledWith(expect.stringMatching(/invalid json/i));
    expect(mockErrorHandler.mock.lastCall[0].message).toMatch(/malformed json/i);
  });

  it('calls error handler if event.data prop is missing', async () => {
    simulatePutEvent({ flags: {} });

    expect(mockListener.deserializeData).not.toBeCalled();
    expect(mockListener.processJson).not.toBeCalled();
    expect(mockErrorHandler.mock.lastCall[0].message).toMatch(/unexpected payload/i);
  });

  it('creates a stream init event', async () => {
    const startTime = Date.now();
    simulatePutEvent();

    const diagnosticEvent = diagnosticsManager.createStatsEventAndReset(0, 0, 0);
    expect(diagnosticEvent.streamInits.length).toEqual(1);
    const si = diagnosticEvent.streamInits[0];
    expect(si.timestamp).toBeGreaterThanOrEqual(startTime);
    expect(si.failed).toBeFalsy();
    expect(si.durationMillis).toBeGreaterThanOrEqual(0);
  });

  // describe('when patching a message', () => {
  //   it('updates a patched flag', async () => {
  //     streamProcessor.start();
  //     const patchData = {
  //       path: '/flags/flagkey',
  //       data: { key: 'flagkey', version: 1 },
  //     };
  //
  //     es.handlers.patch({ data: JSON.stringify(patchData) });
  //
  //     const f = await asyncStore.get(VersionedDataKinds.Features, 'flagkey');
  //     expect(f!.version).toEqual(1);
  //   });
  //
  //   it('updates a patched segment', async () => {
  //     streamProcessor.start();
  //     const patchData = {
  //       path: '/segments/segkey',
  //       data: { key: 'segkey', version: 1 },
  //     };
  //
  //     es.handlers.patch({ data: JSON.stringify(patchData) });
  //
  //     const s = await asyncStore.get(VersionedDataKinds.Segments, 'segkey');
  //     expect(s!.version).toEqual(1);
  //   });
  //
  //   it('passes error to callback if data is invalid', async () => {
  //     streamProcessor.start();
  //
  //     const promise = promiseStart();
  //     es.handlers.patch({ data: '{not-good' });
  //     const result = await promise;
  //     expectJsonError(result as any);
  //   });
  // });
  //
  // describe('when deleting a message', () => {
  //   it('deletes a flag', async () => {
  //     streamProcessor.start();
  //     const flag = { key: 'flagkey', version: 1 };
  //     await asyncStore.upsert(VersionedDataKinds.Features, flag);
  //     const f = await asyncStore.get(VersionedDataKinds.Features, 'flagkey');
  //     expect(f!.version).toEqual(1);
  //
  //     const deleteData = { path: `/flags/${flag.key}`, version: 2 };
  //
  //     es.handlers.delete({ data: JSON.stringify(deleteData) });
  //
  //     const f2 = await asyncStore.get(VersionedDataKinds.Features, 'flagkey');
  //     expect(f2).toBe(null);
  //   });
  //
  //   it('deletes a segment', async () => {
  //     streamProcessor.start();
  //     const segment = { key: 'segkey', version: 1 };
  //     await asyncStore.upsert(VersionedDataKinds.Segments, segment);
  //     const s = await asyncStore.get(VersionedDataKinds.Segments, 'segkey');
  //     expect(s!.version).toEqual(1);
  //
  //     const deleteData = { path: `/segments/${segment.key}`, version: 2 };
  //
  //     es.handlers.delete({ data: JSON.stringify(deleteData) });
  //
  //     const s2 = await asyncStore.get(VersionedDataKinds.Segments, 'segkey');
  //     expect(s2).toBe(null);
  //   });
  //
  //   it('passes error to callback if data is invalid', async () => {
  //     streamProcessor.start();
  //
  //     const promise = promiseStart();
  //     es.handlers.delete({ data: '{not-good' });
  //     const result = await promise;
  //     expectJsonError(result as any);
  //   });
  // });
  //
  // describe.each([400, 408, 429, 500, 503, undefined])('given recoverable http errors', (status) => {
  //   const err = {
  //     status,
  //     message: 'sorry',
  //   };
  //
  //   it(`continues retrying after error: ${status}`, () => {
  //     const startTime = Date.now();
  //     streamProcessor.start();
  //     es.simulateError(err as any);
  //
  //     logger.expectMessages([
  //       {
  //         level: LogLevel.Warn,
  //         matches: status
  //           ? new RegExp(`error ${err.status}.*will retry`)
  //           : /Received I\/O error \(sorry\) for streaming request - will retry/,
  //       },
  //     ]);
  //
  //     const event = diagnosticsManager.createStatsEventAndReset(0, 0, 0);
  //     expect(event.streamInits.length).toEqual(1);
  //     const si = event.streamInits[0];
  //     expect(si.timestamp).toBeGreaterThanOrEqual(startTime);
  //     expect(si.failed).toBeTruthy();
  //     expect(si.durationMillis).toBeGreaterThanOrEqual(0);
  //   });
  // });
  //
  // describe.each([401, 403])('given unrecoverable http errors', (status) => {
  //   const startTime = Date.now();
  //   const err = {
  //     status,
  //     message: 'sorry',
  //   };
  //
  //   it(`stops retrying after error: ${status}`, () => {
  //     streamProcessor.start();
  //     es.simulateError(err as any);
  //
  //     logger.expectMessages([
  //       {
  //         level: LogLevel.Error,
  //         matches: /Received error.*giving up permanently/,
  //       },
  //     ]);
  //
  //     const event = diagnosticsManager.createStatsEventAndReset(0, 0, 0);
  //     expect(event.streamInits.length).toEqual(1);
  //     const si = event.streamInits[0];
  //     expect(si.timestamp).toBeGreaterThanOrEqual(startTime);
  //     expect(si.failed).toBeTruthy();
  //     expect(si.durationMillis).toBeGreaterThanOrEqual(0);
  //   });
  // });
});
