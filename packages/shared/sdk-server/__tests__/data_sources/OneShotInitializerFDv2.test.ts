import { LDFlagDeliveryFallbackError } from '@launchdarkly/js-sdk-common';

import { LDPollingError, subsystem } from '../../src';
import OneShotInitializerFDv2 from '../../src/data_sources/OneShotInitializerFDv2';
import Requestor from '../../src/data_sources/Requestor';
import TestLogger from '../Logger';

describe('given a one shot initializer', () => {
  const requestor = {
    requestAllData: jest.fn(),
  };
  const allEvents = {
    events: [
      {
        event: 'server-intent',
        data: { payloads: [{ intentCode: 'xfer-full', id: 'mockId' }] },
      },
      {
        event: 'put-object',
        data: {
          kind: 'flag',
          key: 'flagA',
          version: 123,
          object: { objectFieldA: 'objectValueA' },
        },
      },
      {
        event: 'payload-transferred',
        data: { state: 'mockState', version: 1 },
      },
    ],
  };
  const jsonData = JSON.stringify(allEvents);

  let initializer: OneShotInitializerFDv2;
  const mockDataCallback = jest.fn();
  const mockStatusCallback = jest.fn();
  let testLogger: TestLogger;

  beforeEach(() => {
    testLogger = new TestLogger();
    initializer = new OneShotInitializerFDv2(requestor as unknown as Requestor, testLogger);
  });

  afterEach(() => {
    initializer.stop();
    jest.restoreAllMocks();
  });

  it('makes no requests before being started', () => {
    expect(requestor.requestAllData).not.toHaveBeenCalled();
  });

  it('polls immediately on start', () => {
    initializer.start(mockDataCallback, mockStatusCallback);
    expect(requestor.requestAllData).toHaveBeenCalledTimes(1);
    expect(mockDataCallback).not.toHaveBeenCalled();
    expect(mockStatusCallback).toHaveBeenNthCalledWith(1, subsystem.DataSourceState.Initializing);
  });

  it('calls callback on success', () => {
    requestor.requestAllData = jest.fn((cb) => cb(undefined, jsonData));
    initializer.start(mockDataCallback, mockStatusCallback);
    expect(mockDataCallback).toHaveBeenNthCalledWith(1, true, {
      initMetadata: undefined,
      payload: {
        type: 'full',
        state: `mockState`,
        updates: [
          {
            kind: `flag`,
            key: `flagA`,
            version: 123,
            object: { objectFieldA: 'objectValueA' },
          },
        ],
        version: 1,
      },
    });
  });

  // On a 200 + directive, the payload and the directive must arrive atomically on the same
  // dataCallback so the composite can swap to FDv1 without losing either.
  it('applies the payload and signals fallback atomically on a 200 + directive', () => {
    const dataCb = jest.fn();
    const statusCb = jest.fn();
    requestor.requestAllData = jest.fn((cb) => cb(undefined, jsonData, undefined, true));
    initializer.start(dataCb, statusCb);

    // A single dataCallback invocation carries both the payload and the fallback marker.
    expect(dataCb).toHaveBeenCalledTimes(1);
    expect(dataCb).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        fallbackToFDv1: true,
        payload: expect.objectContaining({
          type: 'full',
          state: 'mockState',
        }),
      }),
    );

    // No LDFlagDeliveryFallbackError must be emitted via status callback when the
    // directive rides along on a payload -- the composite would have already disabled
    // its callback handler by the time we tried to emit it.
    statusCb.mock.calls.forEach((call: any[]) => {
      expect(call[1]).not.toBeInstanceOf(LDFlagDeliveryFallbackError);
    });
  });

  // Error response + directive: there is no payload to apply, but the directive must still
  // engage FDv1 instead of being treated as an ordinary error.
  it('signals fallback when an error response carries the fallback directive', () => {
    const dataCb = jest.fn();
    const statusCb = jest.fn();
    requestor.requestAllData = jest.fn((cb) =>
      cb({ status: 500, message: 'Internal Server Error' }, undefined, undefined, true),
    );
    initializer.start(dataCb, statusCb);

    expect(dataCb).not.toHaveBeenCalled();
    const lastCall = statusCb.mock.calls[statusCb.mock.calls.length - 1];
    expect(lastCall[0]).toBe(subsystem.DataSourceState.Closed);
    expect(lastCall[1]).toBeInstanceOf(LDFlagDeliveryFallbackError);
  });

  // 200 + directive but the body parses to an event sequence that triggers an actionable
  // PayloadProcessor error. The initializer must still engage FDv1 -- the per-event error
  // must not slip through as a generic LDPollingError.
  it('engages FDv1 when the PayloadProcessor reports an error and the directive is in flight', () => {
    const dataCb = jest.fn();
    const statusCb = jest.fn();
    // payload-transferred without a server-intent triggers PROTOCOL_ERROR (actionable).
    const protocolErrorEvents = {
      events: [
        {
          event: 'payload-transferred',
          data: { state: 'mockState', version: 1 },
        },
      ],
    };
    requestor.requestAllData = jest.fn((cb) =>
      cb(undefined, JSON.stringify(protocolErrorEvents), undefined, true),
    );
    initializer.start(dataCb, statusCb);

    // The terminal status emitted to the composite must be the FDv1-fallback error.
    const errorCalls = statusCb.mock.calls.filter((call: any[]) => call[1] !== undefined);
    expect(errorCalls.length).toBeGreaterThan(0);
    expect(errorCalls[errorCalls.length - 1][1]).toBeInstanceOf(LDFlagDeliveryFallbackError);
    statusCb.mock.calls.forEach((call: any[]) => {
      expect(call[1]).not.toBeInstanceOf(LDPollingError);
    });
  });

  // Malformed body + directive: the parse failure must not suppress the directive.
  it('still signals fallback when the body cannot be parsed', () => {
    const dataCb = jest.fn();
    const statusCb = jest.fn();
    requestor.requestAllData = jest.fn((cb) => cb(undefined, '{not json', undefined, true));
    initializer.start(dataCb, statusCb);

    expect(dataCb).not.toHaveBeenCalled();
    const lastCall = statusCb.mock.calls[statusCb.mock.calls.length - 1];
    expect(lastCall[0]).toBe(subsystem.DataSourceState.Closed);
    expect(lastCall[1]).toBeInstanceOf(LDFlagDeliveryFallbackError);
  });
});
