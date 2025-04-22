import { DataSourceErrorKind, LDPollingError, subsystem } from '../../src';
import OneShotInitializerFDv2 from '../../src/data_sources/OneShotInitializerFDv2';
import PollingProcessorFDv2 from '../../src/data_sources/PollingProcessorFDv2';
import Requestor from '../../src/data_sources/Requestor';
import TestLogger, { LogLevel } from '../Logger';

describe('given a one shot initializer', () => {
  const requestor = {
    requestAllData: jest.fn(),
  };
  const allEvents = {
    events: [
      {
        event: 'server-intent',
        data: { payloads: [{ code: 'xfer-full', id: 'mockId' }] },
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
      basis: true,
      id: `mockId`,
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
    });
  });
});
