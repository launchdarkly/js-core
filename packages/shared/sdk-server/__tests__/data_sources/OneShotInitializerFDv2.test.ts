import { LDFlagDeliveryFallbackError } from '@launchdarkly/js-sdk-common';

import { subsystem } from '../../src';
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

  // Per the FDv2 spec, when the server returns the FDv1 fallback directive alongside a
  // valid 200 response the SDK must apply the accompanying payload AND surface the
  // fallback signal atomically. The directive rides on the same data callback as the
  // payload via `data.fallbackToFDv1`, so CompositeDataSource can swap its synchronizer
  // list to FDv1 before its basis-during-init auto-transition fires. A separate status
  // callback after the data callback would be silently dropped because the composite's
  // callback handler disables itself on basis-during-init.
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

  // When the fallback signal arrives alongside an HTTP error, no payload can be applied
  // but the directive must still be honored so we stop attempting FDv2 sources.
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

  // A malformed body that arrives with the fallback directive must not get stuck retrying
  // FDv2 -- the directive is one-way and takes precedence over the parse failure.
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
