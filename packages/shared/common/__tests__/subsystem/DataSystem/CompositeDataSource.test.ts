import {
  DataSource,
  DataSourceState,
  LDDataSourceFactory,
} from '../../../src/api/subsystem/DataSystem/DataSource';
import { Backoff } from '../../../src/datasource/Backoff';
import {
  CompositeDataSource,
  TransitionConditions,
} from '../../../src/datasource/CompositeDataSource';
import { DataSourceErrorKind } from '../../../src/datasource/DataSourceErrorKinds';
import { LDFlagDeliveryFallbackError, LDPollingError } from '../../../src/datasource/errors';

function makeDataSourceFactory(internal: DataSource): LDDataSourceFactory {
  return () => internal;
}

function makeTestTransitionConditions(): TransitionConditions {
  return {
    [DataSourceState.Interrupted]: {
      durationMS: 0,
      transition: 'fallback',
    },
    [DataSourceState.Valid]: {
      durationMS: 0,
      transition: 'recover',
    },
  };
}

function makeZeroBackoff(): Backoff {
  return {
    success() {
      return 0;
    },
    fail() {
      return 0;
    },
  };
}

it('handles initializer getting basis, switching to synchronizer', async () => {
  const mockInitializer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid);
          _dataCallback(true, { key: 'init1' });
          _statusCallback(DataSourceState.Closed);
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer1Data = { key: 'sync1' };
  const mockSynchronizer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid);
          _dataCallback(false, mockSynchronizer1Data);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer1)],
    [makeDataSourceFactory(mockSynchronizer1)],
    [],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let dataCallback;
  const statusCallback = jest.fn();
  await new Promise<void>((resolve) => {
    dataCallback = jest.fn((_: boolean, data: any) => {
      if (data === mockSynchronizer1Data) {
        resolve();
      }
    });

    underTest.start(dataCallback, statusCallback);
  });

  expect(mockInitializer1.start).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer1.start).toHaveBeenCalledTimes(1);
  expect(dataCallback).toHaveBeenCalledTimes(2);
  expect(dataCallback).toHaveBeenNthCalledWith(1, true, { key: 'init1' });
  expect(dataCallback).toHaveBeenNthCalledWith(2, false, { key: 'sync1' });
  expect(statusCallback).toHaveBeenCalledTimes(4);
  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Initializing, undefined);
  expect(statusCallback).toHaveBeenNthCalledWith(2, DataSourceState.Valid, undefined);
  expect(statusCallback).toHaveBeenNthCalledWith(3, DataSourceState.Interrupted, undefined);
  expect(statusCallback).toHaveBeenNthCalledWith(4, DataSourceState.Valid, undefined);
});

it('handles initializer getting error and switches to synchronizer 1', async () => {
  const mockInitializer1: DataSource = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(
            DataSourceState.Closed,
            new LDPollingError(DataSourceErrorKind.ErrorResponse, 'polling error'),
          );
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer1Data = { key: 'sync1' };
  const mockSynchronizer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid, null); // this should lead to recovery
          _dataCallback(true, mockSynchronizer1Data);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer1)],
    [makeDataSourceFactory(mockSynchronizer1)],
    [],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let callback;
  const statusCallback = jest.fn();
  await new Promise<void>((resolve) => {
    callback = jest.fn((_: boolean, data: any) => {
      if (data === mockSynchronizer1Data) {
        resolve();
      }
    });

    underTest.start(callback, statusCallback);
  });

  expect(mockInitializer1.start).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer1.start).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenNthCalledWith(1, true, { key: 'sync1' });
  expect(statusCallback).toHaveBeenCalledTimes(3);
  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Initializing, undefined);
  expect(statusCallback).toHaveBeenNthCalledWith(2, DataSourceState.Interrupted, expect.anything()); // sync1 error
  expect(statusCallback).toHaveBeenNthCalledWith(3, DataSourceState.Valid, undefined); // sync1 got data
});

it('handles initializer getting basis, switches to synchronizer 1, falls back to synchronizer 2, recovers to synchronizer 1', async () => {
  const mockInitializer1: DataSource = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid);
          _dataCallback(true, { key: 'init1' });
          _statusCallback(DataSourceState.Closed);
        },
      ),
    stop: jest.fn(),
  };

  let sync1RunCount = 0;
  const mockSynchronizer1Data = { key: 'sync1' };
  const mockSynchronizer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          if (sync1RunCount === 0) {
            _statusCallback(DataSourceState.Initializing);
            _statusCallback(DataSourceState.Closed, {
              name: 'Error',
              message: 'I am error...man!',
            }); // error that will lead to fallback
          } else {
            _statusCallback(DataSourceState.Initializing);
            _statusCallback(DataSourceState.Valid);
            _dataCallback(false, mockSynchronizer1Data); // second start will lead to data
          }
          sync1RunCount += 1;
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer2Data = { key: 'sync2' };
  const mockSynchronizer2 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid, null); // this should lead to recovery
          _dataCallback(false, mockSynchronizer2Data);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer1)],
    [makeDataSourceFactory(mockSynchronizer1), makeDataSourceFactory(mockSynchronizer2)],
    [],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let callback;
  const statusCallback = jest.fn();
  await new Promise<void>((resolve) => {
    callback = jest.fn((_: boolean, data: any) => {
      if (data === mockSynchronizer1Data) {
        resolve();
      }
    });

    underTest.start(callback, statusCallback);
  });

  expect(mockInitializer1.start).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer1.start).toHaveBeenCalledTimes(2);
  expect(mockSynchronizer2.start).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledTimes(3);
  expect(callback).toHaveBeenNthCalledWith(1, true, { key: 'init1' });
  expect(callback).toHaveBeenNthCalledWith(2, false, { key: 'sync2' }); // sync1 errors and fallsback
  expect(callback).toHaveBeenNthCalledWith(3, false, { key: 'sync1' }); // sync2 recovers back to sync1
  expect(statusCallback).toHaveBeenCalledTimes(7);
  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Initializing, undefined);
  expect(statusCallback).toHaveBeenNthCalledWith(2, DataSourceState.Valid, undefined); // initializer got data
  expect(statusCallback).toHaveBeenNthCalledWith(3, DataSourceState.Interrupted, undefined); // initializer closed
  expect(statusCallback).toHaveBeenNthCalledWith(4, DataSourceState.Interrupted, expect.anything()); // sync1 error
  expect(statusCallback).toHaveBeenNthCalledWith(5, DataSourceState.Valid, undefined); // sync2 got data
  expect(statusCallback).toHaveBeenNthCalledWith(6, DataSourceState.Interrupted, undefined); // recover to sync1
  expect(statusCallback).toHaveBeenNthCalledWith(7, DataSourceState.Valid, undefined); // sync1 valid
});

it('removes synchronizer that reports unrecoverable error and loops on remaining synchronizer', async () => {
  const mockInitializer1: DataSource = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid);
          _dataCallback(true, { key: 'init1' });
          _statusCallback(DataSourceState.Closed);
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Closed, {
            name: 'Error',
            message: 'I am an unrecoverable error!', // error will lead to culling,
            recoverable: false,
          });
        },
      ),
    stop: jest.fn(),
  };

  let sync2RunCount = 0;
  const mockSynchronizer2Data = { key: 'sync2' };
  const mockSynchronizer2 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          if (sync2RunCount < 5) {
            _statusCallback(DataSourceState.Initializing);
            _statusCallback(DataSourceState.Closed, {
              name: 'Error',
              message: `I am a recoverable error ${sync2RunCount}`,
            }); // error that will lead to fallback
          } else {
            _statusCallback(DataSourceState.Initializing);
            _statusCallback(DataSourceState.Valid);
            _dataCallback(false, mockSynchronizer2Data); // second start will lead to data
          }
          sync2RunCount += 1;
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer1)],
    [makeDataSourceFactory(mockSynchronizer1), makeDataSourceFactory(mockSynchronizer2)],
    [],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let dataCallback;
  const statusCallback = jest.fn();
  await new Promise<void>((resolve) => {
    dataCallback = jest.fn((_: boolean, data: any) => {
      if (data === mockSynchronizer2Data) {
        resolve();
      }
    });

    underTest.start(dataCallback, statusCallback);
  });

  expect(mockInitializer1.start).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer1.start).toHaveBeenCalledTimes(1); // only called the first time
  expect(mockSynchronizer2.start).toHaveBeenCalledTimes(6); // called 5 times with recoverable errors then 6th time succeeds
  expect(dataCallback).toHaveBeenCalledTimes(2);
  expect(dataCallback).toHaveBeenNthCalledWith(1, true, { key: 'init1' });
  expect(dataCallback).toHaveBeenNthCalledWith(2, false, { key: 'sync2' });
  expect(statusCallback).toHaveBeenCalledTimes(10);
  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Initializing, undefined);
  expect(statusCallback).toHaveBeenNthCalledWith(2, DataSourceState.Valid, undefined); // initializer got data
  expect(statusCallback).toHaveBeenNthCalledWith(3, DataSourceState.Interrupted, undefined); // initializer closed
  expect(statusCallback).toHaveBeenNthCalledWith(4, DataSourceState.Interrupted, expect.anything()); // sync1 unrecoverable error
  expect(statusCallback).toHaveBeenNthCalledWith(5, DataSourceState.Interrupted, expect.anything()); // sync2 recoverable error
  expect(statusCallback).toHaveBeenNthCalledWith(6, DataSourceState.Interrupted, expect.anything()); // sync2 recoverable error
  expect(statusCallback).toHaveBeenNthCalledWith(7, DataSourceState.Interrupted, expect.anything()); // sync2 recoverable error
  expect(statusCallback).toHaveBeenNthCalledWith(8, DataSourceState.Interrupted, expect.anything()); // sync2 recoverable error
  expect(statusCallback).toHaveBeenNthCalledWith(9, DataSourceState.Interrupted, expect.anything()); // sync2 recoverable error
  expect(statusCallback).toHaveBeenNthCalledWith(10, DataSourceState.Valid, undefined); // sync1 valid
});

it('falls back to FDv1 synchronizers when FDv1 fallback error is reported', async () => {
  const mockInitializer1: DataSource = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid);
          _dataCallback(true, { key: 'init1' });
          _statusCallback(DataSourceState.Closed);
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(
            DataSourceState.Closed,
            new LDFlagDeliveryFallbackError(
              DataSourceErrorKind.ErrorResponse,
              `Response header indicates to fallback to FDv1`,
              403,
            ),
          );
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer2 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Closed, {
            name: 'Error',
            message: 'I should NOT be called due to FDv1 Fallback',
          });
        },
      ),
    stop: jest.fn(),
  };

  const mockFDv1Data = { key: 'FDv1Data' };
  const mockFDv1Synchronizer = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid, null); // this should lead to recovery
          _dataCallback(false, mockFDv1Data);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer1)],
    [makeDataSourceFactory(mockSynchronizer1), makeDataSourceFactory(mockSynchronizer2)],
    [makeDataSourceFactory(mockFDv1Synchronizer)],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let dataCallback;
  const statusCallback = jest.fn();
  await new Promise<void>((resolve) => {
    dataCallback = jest.fn((_: boolean, data: any) => {
      if (data === mockFDv1Data) {
        resolve();
      }
    });

    underTest.start(dataCallback, statusCallback);
  });

  expect(mockInitializer1.start).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer1.start).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer2.start).toHaveBeenCalledTimes(0); // this synchronizer should not be called because we fall back to FDv1 synchronizers instead
  expect(mockFDv1Synchronizer.start).toHaveBeenCalledTimes(1);
  expect(dataCallback).toHaveBeenCalledTimes(2);
  expect(dataCallback).toHaveBeenNthCalledWith(1, true, { key: 'init1' });
  expect(dataCallback).toHaveBeenNthCalledWith(2, false, { key: 'FDv1Data' });
  expect(statusCallback).toHaveBeenCalledTimes(5);
  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Initializing, undefined);
  expect(statusCallback).toHaveBeenNthCalledWith(2, DataSourceState.Valid, undefined); // initializer got data
  expect(statusCallback).toHaveBeenNthCalledWith(3, DataSourceState.Interrupted, undefined); // initializer closed
  expect(statusCallback).toHaveBeenNthCalledWith(4, DataSourceState.Interrupted, expect.anything()); // sync1 fdv1 fallback error
  expect(statusCallback).toHaveBeenNthCalledWith(5, DataSourceState.Valid, undefined); // sync1 valid
});

// Per the FDv2 spec, the FDv1 Fallback Directive can arrive during the initializer phase.
// When that happens the SDK must switch immediately to the FDv1 Fallback Synchronizer --
// without trying remaining initializers or any FDv2 synchronizers.
it('falls back to FDv1 from initializer phase, skipping remaining initializers and FDv2 syncs', async () => {
  const mockInitializer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(
            DataSourceState.Closed,
            new LDFlagDeliveryFallbackError(
              DataSourceErrorKind.ErrorResponse,
              `Response header indicates to fallback to FDv1`,
              500,
            ),
          );
        },
      ),
    stop: jest.fn(),
  };

  const mockInitializer2: DataSource = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Closed, {
            name: 'Error',
            message: 'I should NOT be called due to FDv1 fallback from init1',
          });
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Closed, {
            name: 'Error',
            message: 'I should NOT be called due to FDv1 fallback from init1',
          });
        },
      ),
    stop: jest.fn(),
  };

  const mockFDv1Data = { key: 'FDv1Data' };
  const mockFDv1Synchronizer = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid, null);
          _dataCallback(true, mockFDv1Data);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer1), makeDataSourceFactory(mockInitializer2)],
    [makeDataSourceFactory(mockSynchronizer1)],
    [makeDataSourceFactory(mockFDv1Synchronizer)],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let dataCallback;
  const statusCallback = jest.fn();
  await new Promise<void>((resolve) => {
    dataCallback = jest.fn((_: boolean, data: any) => {
      if (data === mockFDv1Data) {
        resolve();
      }
    });
    underTest.start(dataCallback, statusCallback);
  });

  expect(mockInitializer1.start).toHaveBeenCalledTimes(1);
  expect(mockInitializer2.start).not.toHaveBeenCalled();
  expect(mockSynchronizer1.start).not.toHaveBeenCalled();
  expect(mockFDv1Synchronizer.start).toHaveBeenCalledTimes(1);
  expect(dataCallback).toHaveBeenCalledTimes(1);
  expect(dataCallback).toHaveBeenCalledWith(true, mockFDv1Data);
});

// When the FDv1 Fallback Directive arrives but the SDK has not been configured with an
// FDv1 fallback synchronizer, the data source must transition to a terminal Closed state
// instead of looping or trying other FDv2 sources.
it('terminates when FDv1 fallback is requested but no FDv1 fallback synchronizer is configured', async () => {
  const mockSynchronizer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(
            DataSourceState.Closed,
            new LDFlagDeliveryFallbackError(
              DataSourceErrorKind.ErrorResponse,
              `Response header indicates to fallback to FDv1`,
              500,
            ),
          );
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [],
    [makeDataSourceFactory(mockSynchronizer1)],
    [], // no FDv1 fallback synchronizer
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  const statusCallback = jest.fn();
  const dataCallback = jest.fn();
  await new Promise<void>((resolve) => {
    statusCallback.mockImplementation((state: DataSourceState) => {
      if (state === DataSourceState.Closed) {
        resolve();
      }
    });
    underTest.start(dataCallback, statusCallback);
  });

  // The underlying synchronizer was started exactly once -- we did not loop trying other
  // FDv2 sources after the directive arrived.
  expect(mockSynchronizer1.start).toHaveBeenCalledTimes(1);
  expect(dataCallback).not.toHaveBeenCalled();

  // The terminal status is Closed (composite signals exhaustion when the FDv1 list is empty).
  const lastCall = statusCallback.mock.calls[statusCallback.mock.calls.length - 1];
  expect(lastCall[0]).toBe(DataSourceState.Closed);
});

// Regression for the bug where a data source delivered basis-during-init AND THEN emitted
// LDFlagDeliveryFallbackError as a status callback: the auto-transition on basis would
// disable the callback handler before the fallback signal was processed, leaving
// `_syncFactories` pointing at the FDv2 list. The fix is to ride the directive on the data
// callback itself (via `data.fallbackToFDv1`), so the swap to FDv1 is atomic with the
// payload application.
it('switches to FDv1 when an initializer delivers basis with fallbackToFDv1 marker', async () => {
  const mockInitData = { fallbackToFDv1: true, payload: { key: 'init-payload' } };
  const mockInitializer = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid);
          // Basis arrives with the directive attached. The composite must apply the payload
          // (via dataCallback) AND swap synchronizer factories to FDv1 atomically; the
          // FDv2 synchronizer below must NOT be started.
          _dataCallback(true, mockInitData);
        },
      ),
    stop: jest.fn(),
  };

  const mockFDv2Synchronizer = {
    start: jest.fn().mockImplementation(() => {
      throw new Error('FDv2 synchronizer should not be started after FDv1 fallback');
    }),
    stop: jest.fn(),
  };

  const mockFDv1Data = { key: 'FDv1Data' };
  const mockFDv1Synchronizer = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid, null);
          _dataCallback(true, mockFDv1Data);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer)],
    [makeDataSourceFactory(mockFDv2Synchronizer)],
    [makeDataSourceFactory(mockFDv1Synchronizer)],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  const dataReceived: any[] = [];
  const statusCallback = jest.fn();
  await new Promise<void>((resolve) => {
    const dataCallback = jest.fn((_: boolean, data: any) => {
      dataReceived.push(data);
      if (data === mockFDv1Data) {
        resolve();
      }
    });
    underTest.start(dataCallback, statusCallback);
  });

  // The composite forwarded the initializer's payload AND then ran the FDv1 synchronizer.
  // FDv2 synchronizers must not have been started.
  expect(mockInitializer.start).toHaveBeenCalledTimes(1);
  expect(mockFDv2Synchronizer.start).not.toHaveBeenCalled();
  expect(mockFDv1Synchronizer.start).toHaveBeenCalledTimes(1);

  // The init payload was forwarded to the outer dataCallback before FDv1 took over.
  expect(dataReceived[0]).toBe(mockInitData);
  expect(dataReceived[1]).toBe(mockFDv1Data);
});

// Regression for the bug where a synchronizer delivered a payload with fallbackToFDv1 AND
// THEN emitted an error: the basis-during-init auto-transition (or the error status path)
// would disable the callback handler before the fallback signal was processed.
it('switches to FDv1 when a synchronizer delivers a payload with fallbackToFDv1 marker', async () => {
  const mockSynchronizerData = { fallbackToFDv1: true, payload: { key: 'sync-payload' } };
  const mockSynchronizer = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid);
          // Payload + directive on a single dataCallback invocation. There are no
          // initializers configured here so this exercises the synchronizer-phase path.
          _dataCallback(true, mockSynchronizerData);
        },
      ),
    stop: jest.fn(),
  };

  const mockFDv1Data = { key: 'FDv1Data' };
  const mockFDv1Synchronizer = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid, null);
          _dataCallback(true, mockFDv1Data);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [],
    [makeDataSourceFactory(mockSynchronizer)],
    [makeDataSourceFactory(mockFDv1Synchronizer)],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  const dataReceived: any[] = [];
  await new Promise<void>((resolve) => {
    const dataCallback = jest.fn((_: boolean, data: any) => {
      dataReceived.push(data);
      if (data === mockFDv1Data) {
        resolve();
      }
    });
    underTest.start(dataCallback, jest.fn());
  });

  expect(mockSynchronizer.start).toHaveBeenCalledTimes(1);
  expect(mockFDv1Synchronizer.start).toHaveBeenCalledTimes(1);
  expect(dataReceived[0]).toBe(mockSynchronizerData);
  expect(dataReceived[1]).toBe(mockFDv1Data);
});

// Regression: subsequent fallback signals after the FDv1 synchronizer is engaged must be
// ignored so the composite does not loop replacing its synchronizer list with itself.
// This guards against an FDv1 endpoint that erroneously echoes `x-ld-fd-fallback` -- the
// circular DataSourceList for `_fdv1Synchronizers` would otherwise restart the same
// FDv1 synchronizer indefinitely after each repeated directive.
it('ignores subsequent FDv1 fallback signals once FDv1 fallback is engaged', async () => {
  const mockFDv2Sync = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(
            DataSourceState.Closed,
            new LDFlagDeliveryFallbackError(
              DataSourceErrorKind.ErrorResponse,
              'fallback from FDv2',
              500,
            ),
          );
        },
      ),
    stop: jest.fn(),
  };

  // The FDv1 fallback synchronizer continually delivers a basis with a fallback marker --
  // this would loop indefinitely without the engagement guard, since `_fdv1Synchronizers`
  // is a circular list and `switchToSync` restarts from its head.
  const fdv1Data = { fallbackToFDv1: true, payload: { key: 'fdv1-data' } };
  let fdv1StartCount = 0;
  const mockFDv1Synchronizer = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          fdv1StartCount += 1;
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid, null);
          _dataCallback(true, fdv1Data);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [],
    [makeDataSourceFactory(mockFDv2Sync)],
    [makeDataSourceFactory(mockFDv1Synchronizer)],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  const dataReceived: any[] = [];
  const statusCallback = jest.fn();
  // Wait for the FDv1 data callback so we know the FDv1 synchronizer ran. After that, we
  // give the event loop a tick to confirm the FDv1 synchronizer is not restarted.
  await new Promise<void>((resolve) => {
    const dataCallback = jest.fn((_: boolean, data: any) => {
      dataReceived.push(data);
      if (data === fdv1Data) {
        resolve();
      }
    });
    underTest.start(dataCallback, statusCallback);
  });
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

  // FDv1 was started exactly once -- the engagement guard prevented re-engagement when
  // FDv1 itself echoed the directive.
  expect(fdv1StartCount).toBe(1);
  // The FDv1 payload was applied even though we ignored the (redundant) directive.
  expect(dataReceived).toContain(fdv1Data);
});

it('reports error when all initializers fail', async () => {
  const mockInitializer1Error = {
    name: 'Error',
    message: 'I am initializer1 error!',
  };
  const mockInitializer1: DataSource = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Closed, mockInitializer1Error);
        },
      ),
    stop: jest.fn(),
  };

  const mockInitializer2Error = {
    name: 'Error',
    message: 'I am initializer2 error!',
  };
  const mockInitializer2: DataSource = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Closed, mockInitializer2Error);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer1), makeDataSourceFactory(mockInitializer2)],
    [], // no synchronizers for this test
    [],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  const dataCallback = jest.fn();
  let statusCallback;
  await new Promise<void>((resolve) => {
    statusCallback = jest.fn((_: DataSourceState, err?: any) => {
      if (err?.name === 'ExhaustedDataSources') {
        resolve();
      }
    });

    underTest.start(dataCallback, statusCallback);
  });

  expect(mockInitializer1.start).toHaveBeenCalledTimes(1);
  expect(mockInitializer2.start).toHaveBeenCalledTimes(1);
  expect(dataCallback).toHaveBeenCalledTimes(0);
  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Initializing, undefined);
  expect(statusCallback).toHaveBeenNthCalledWith(
    2,
    DataSourceState.Interrupted,
    mockInitializer1Error,
  );
  expect(statusCallback).toHaveBeenNthCalledWith(
    3,
    DataSourceState.Interrupted,
    mockInitializer2Error,
  );
  expect(statusCallback).toHaveBeenNthCalledWith(4, DataSourceState.Closed, {
    name: 'ExhaustedDataSources',
    message: 'CompositeDataSource has exhausted all configured initializers and synchronizers.',
  });
  expect(statusCallback).toHaveBeenCalledTimes(4);
});

it('it reports DataSourceState Closed when all synchronizers report Closed with unrecoverable errors', async () => {
  const mockInitializer1: DataSource = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid);
          _dataCallback(true, { key: 'init1' });
          _statusCallback(DataSourceState.Closed);
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Closed, {
            name: 'Error1',
            message: 'I am an unrecoverable error!',
            recoverable: false,
          });
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer2 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Closed, {
            name: 'Error2',
            message: 'I am an unrecoverable error!',
            recoverable: false,
          });
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer1)],
    [makeDataSourceFactory(mockSynchronizer1), makeDataSourceFactory(mockSynchronizer2)],
    [],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let statusCallback;
  await new Promise<void>((resolve) => {
    statusCallback = jest.fn((state: DataSourceState, _: any) => {
      if (state === DataSourceState.Closed) {
        resolve();
      }
    });

    underTest.start(jest.fn(), statusCallback);
  });

  expect(mockInitializer1.start).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer1.start).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer2.start).toHaveBeenCalledTimes(1);
  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Initializing, undefined);
  expect(statusCallback).toHaveBeenNthCalledWith(2, DataSourceState.Valid, undefined);
  expect(statusCallback).toHaveBeenNthCalledWith(3, DataSourceState.Interrupted, undefined); // initializer closes properly
  expect(statusCallback).toHaveBeenNthCalledWith(4, DataSourceState.Interrupted, expect.anything()); // sync1 closed with unrecoverable error
  expect(statusCallback).toHaveBeenNthCalledWith(5, DataSourceState.Interrupted, expect.anything()); // sync2 closed with unrecoverable error
  expect(statusCallback).toHaveBeenNthCalledWith(6, DataSourceState.Closed, {
    name: 'ExhaustedDataSources',
    message: `CompositeDataSource has exhausted all configured initializers and synchronizers.`,
  });
});

it('can be stopped when in thrashing synchronizer fallback loop', async () => {
  const mockInitializer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _dataCallback(true, { key: 'init1' });
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer1Error = { name: 'Error', message: 'I am error...man!' };
  const mockSynchronizer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Closed, mockSynchronizer1Error); // error that will lead to fallback
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer1)],
    [makeDataSourceFactory(mockSynchronizer1)], // will continuously fallback onto itself
    [],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  const dataCallback = jest.fn();
  let statusCallback;
  await new Promise<void>((resolve) => {
    statusCallback = jest.fn((state: DataSourceState, err: any) => {
      if (state === DataSourceState.Interrupted && err === mockSynchronizer1Error) {
        resolve(); // waiting interruption due to sync error
      }
    });

    underTest.start(dataCallback, statusCallback);
  });

  expect(mockInitializer1.start).toHaveBeenCalled();
  expect(mockSynchronizer1.start).toHaveBeenCalled();
  expect(dataCallback).toHaveBeenNthCalledWith(1, true, { key: 'init1' });
  underTest.stop();

  // wait for stop to take effect before checking status is closed
  await new Promise((f) => {
    setTimeout(f, 100);
  });

  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Initializing, undefined); // initializer
  expect(statusCallback).toHaveBeenNthCalledWith(2, DataSourceState.Interrupted, undefined); // initializer closes
  expect(statusCallback).toHaveBeenNthCalledWith(
    3,
    DataSourceState.Interrupted,
    mockSynchronizer1Error,
  ); // synchronizer error
  expect(statusCallback).toHaveBeenNthCalledWith(4, DataSourceState.Closed, undefined); // stop composite source
});

it('can be stopped and restarted', async () => {
  const mockInitializer1Data = { key: 'init1' };
  const mockInitializer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _dataCallback(true, mockInitializer1Data);
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer1Data = { key: 'sync1' };
  const mockSynchronizer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _dataCallback(false, mockSynchronizer1Data);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer1)],
    [makeDataSourceFactory(mockSynchronizer1)],
    [],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let callback1;
  await new Promise<void>((resolve) => {
    callback1 = jest.fn((_: boolean, data: any) => {
      if (data === mockSynchronizer1Data) {
        underTest.stop();
        resolve();
      }
    });
    // first start
    underTest.start(callback1, jest.fn());
  });

  // check first start triggered underlying data sources
  expect(mockInitializer1.start).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer1.start).toHaveBeenCalledTimes(1);
  expect(callback1).toHaveBeenCalledTimes(2);

  // wait a moment for pending awaits to resolve the stop request
  await new Promise((f) => {
    setTimeout(f, 1);
  });

  let callback2;
  await new Promise<void>((resolve) => {
    callback2 = jest.fn((_: boolean, data: any) => {
      if (data === mockSynchronizer1Data) {
        resolve();
      }
    });
    // second start
    underTest.start(callback2, jest.fn());
  });

  // check that second start triggers underlying data sources again
  expect(mockInitializer1.start).toHaveBeenCalledTimes(2);
  expect(mockSynchronizer1.start).toHaveBeenCalledTimes(2);
  expect(callback2).toHaveBeenCalledTimes(2);
});

it('is well behaved with no initializers and no synchronizers configured', async () => {
  const underTest = new CompositeDataSource(
    [],
    [],
    [],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let statusCallback;
  await new Promise<void>((resolve) => {
    statusCallback = jest.fn((state: DataSourceState, _2: any) => {
      if (state === DataSourceState.Closed) {
        resolve();
      }
    });

    underTest.start(jest.fn(), statusCallback);
  });

  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Initializing, undefined); // initializer
  expect(statusCallback).toHaveBeenNthCalledWith(2, DataSourceState.Closed, {
    name: 'ExhaustedDataSources',
    message: 'CompositeDataSource has exhausted all configured initializers and synchronizers.',
  });
});

it('is well behaved with no initializer and synchronizer configured', async () => {
  const mockSynchronizer1Data = { key: 'sync1' };
  const mockSynchronizer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid);
          _dataCallback(false, mockSynchronizer1Data);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [],
    [makeDataSourceFactory(mockSynchronizer1)],
    [],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let dataCallback;
  const statusCallback = jest.fn();
  await new Promise<void>((resolve) => {
    dataCallback = jest.fn(() => {
      resolve();
    });

    underTest.start(dataCallback, statusCallback);
  });

  expect(dataCallback).toHaveBeenNthCalledWith(1, false, { key: 'sync1' });
  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Initializing, undefined);
  expect(statusCallback).toHaveBeenNthCalledWith(2, DataSourceState.Valid, undefined);
});

it('is well behaved with an initializer and no synchronizers configured', async () => {
  const mockInitializer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid);
          _dataCallback(true, { key: 'init1' });
          _statusCallback(DataSourceState.Closed);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer1)],
    [],
    [],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let dataCallback;
  let statusCallback;
  await new Promise<void>((resolve) => {
    dataCallback = jest.fn();
    statusCallback = jest.fn((state: DataSourceState, _2: any) => {
      if (state === DataSourceState.Closed) {
        resolve();
      }
    });

    underTest.start(dataCallback, statusCallback);
  });

  expect(dataCallback).toHaveBeenNthCalledWith(1, true, { key: 'init1' });
  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Initializing, undefined);
  expect(statusCallback).toHaveBeenNthCalledWith(2, DataSourceState.Valid, undefined); // initializer got data
  expect(statusCallback).toHaveBeenNthCalledWith(3, DataSourceState.Interrupted, undefined); // initializer got data
  expect(statusCallback).toHaveBeenNthCalledWith(4, DataSourceState.Closed, {
    name: 'ExhaustedDataSources',
    message: 'CompositeDataSource has exhausted all configured initializers and synchronizers.',
  });
});

it('consumes cancellation tokens correctly', async () => {
  const mockInitializer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _dataCallback(true, { key: 'init1' });
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid);
          _statusCallback(DataSourceState.Interrupted); // report interrupted to schedule automatic transition and create cancellation token
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer1)],
    [makeDataSourceFactory(mockSynchronizer1)],
    [],
    undefined,
    {
      // pass in transition condition so that it will thrash, generating cancellation tokens repeatedly
      [DataSourceState.Interrupted]: {
        durationMS: 100,
        transition: 'fallback',
      },
    },
    makeZeroBackoff(),
  );

  let dataCallback;
  let statusCallback;
  let interruptedCount = 0;
  await new Promise<void>((resolve) => {
    dataCallback = jest.fn();
    statusCallback = jest.fn((state: DataSourceState, _2: any) => {
      if (state === DataSourceState.Interrupted) {
        interruptedCount += 1;
        if (interruptedCount > 10) {
          // let it thrash for N iterations
          resolve();
        }
      }
    });

    underTest.start(dataCallback, statusCallback);
  });

  // @ts-ignore
  // eslint-disable-next-line no-underscore-dangle
  expect(underTest._cancelTokens.length).toEqual(1);

  underTest.stop();

  // @ts-ignore
  // eslint-disable-next-line no-underscore-dangle
  expect(underTest._cancelTokens.length).toEqual(0);
});

it('handles multiple initializers with fallback when first initializer fails and second succeeds', async () => {
  const mockInitializer1Error = {
    name: 'Error',
    message: 'First initializer failed',
  };
  const mockInitializer1: DataSource = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Closed, mockInitializer1Error);
        },
      ),
    stop: jest.fn(),
  };

  const mockInitializer2Data = { key: 'init2' };
  const mockInitializer2: DataSource = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid);
          _dataCallback(true, mockInitializer2Data);
          _statusCallback(DataSourceState.Closed);
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer1Data = { key: 'sync1' };
  const mockSynchronizer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid);
          _dataCallback(false, mockSynchronizer1Data);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer1), makeDataSourceFactory(mockInitializer2)],
    [makeDataSourceFactory(mockSynchronizer1)],
    [],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let dataCallback;
  const statusCallback = jest.fn();
  await new Promise<void>((resolve) => {
    dataCallback = jest.fn((_: boolean, data: any) => {
      if (data === mockSynchronizer1Data) {
        resolve();
      }
    });

    underTest.start(dataCallback, statusCallback);
  });

  expect(mockInitializer1.start).toHaveBeenCalledTimes(1);
  expect(mockInitializer2.start).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer1.start).toHaveBeenCalledTimes(1);
  expect(statusCallback).toHaveBeenCalledTimes(5);
  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Initializing, undefined);
  expect(statusCallback).toHaveBeenNthCalledWith(
    2,
    DataSourceState.Interrupted,
    mockInitializer1Error,
  );
  expect(statusCallback).toHaveBeenNthCalledWith(3, DataSourceState.Valid, undefined);
  expect(statusCallback).toHaveBeenNthCalledWith(4, DataSourceState.Interrupted, undefined);
  expect(statusCallback).toHaveBeenNthCalledWith(5, DataSourceState.Valid, undefined);
});

it('does not run second initializer when first initializer succeeds', async () => {
  const mockInitializer1Data = { key: 'init1' };
  const mockInitializer1: DataSource = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid);
          _dataCallback(true, mockInitializer1Data);
          _statusCallback(DataSourceState.Closed);
        },
      ),
    stop: jest.fn(),
  };

  const mockInitializer2: DataSource = {
    start: jest.fn(),
    stop: jest.fn(),
  };

  const mockSynchronizer1Data = { key: 'sync1' };
  const mockSynchronizer1 = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Initializing);
          _statusCallback(DataSourceState.Valid);
          _dataCallback(false, mockSynchronizer1Data);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer1), makeDataSourceFactory(mockInitializer2)],
    [makeDataSourceFactory(mockSynchronizer1)],
    [],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let dataCallback;
  const statusCallback = jest.fn();
  await new Promise<void>((resolve) => {
    dataCallback = jest.fn((_: boolean, data: any) => {
      if (data === mockSynchronizer1Data) {
        resolve();
      }
    });

    underTest.start(dataCallback, statusCallback);
  });

  expect(mockInitializer1.start).toHaveBeenCalledTimes(1);
  expect(mockInitializer2.start).toHaveBeenCalledTimes(0);
  expect(mockSynchronizer1.start).toHaveBeenCalledTimes(1);
});
