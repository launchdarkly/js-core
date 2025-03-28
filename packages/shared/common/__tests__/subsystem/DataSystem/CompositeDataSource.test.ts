import {
  DataSourceState,
  DataSystemInitializer,
  DataSystemSynchronizer,
  LDInitializerFactory,
  LDSynchronizerFactory,
} from '../../../src/api/subsystem/DataSystem/DataSource';
import { Backoff } from '../../../src/datasource/Backoff';
import {
  CompositeDataSource,
  TransitionConditions,
} from '../../../src/datasource/CompositeDataSource';

function makeInitializerFactory(internal: DataSystemInitializer): LDInitializerFactory {
  return () => internal;
}

function makeSynchronizerFactory(internal: DataSystemSynchronizer): LDSynchronizerFactory {
  return () => internal;
}

function makeTestTransitionConditions(): TransitionConditions {
  return {
    [DataSourceState.Initializing]: {
      durationMS: 0,
      transition: 'fallback',
    },
    [DataSourceState.Interrupted]: {
      durationMS: 0,
      transition: 'fallback',
    },
    [DataSourceState.Closed]: {
      durationMS: 0,
      transition: 'fallback',
    },
    [DataSourceState.Valid]: {
      durationMS: 0,
      transition: 'fallback',
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

it('handles initializer getting basis, switching to syncrhonizer', async () => {
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
    [makeInitializerFactory(mockInitializer1)],
    [makeSynchronizerFactory(mockSynchronizer1)],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let callback;
  await new Promise<void>((resolve) => {
    callback = jest.fn((_: boolean, data: any) => {
      if (data === mockSynchronizer1Data) {
        resolve();
      }
    });

    underTest.start(callback, jest.fn());
  });

  expect(mockInitializer1.start).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer1.start).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledTimes(2);
  expect(callback).toHaveBeenNthCalledWith(1, true, { key: 'init1' });
  expect(callback).toHaveBeenNthCalledWith(2, false, { key: 'sync1' });
});

it('handles initializer getting basis, switches to synchronizer 1, falls back to synchronizer 2, recovers to synchronizer 1', async () => {
  const mockInitializer1: DataSystemInitializer = {
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
            _statusCallback(DataSourceState.Closed, {
              name: 'Error',
              message: 'I am error...man!',
            }); // error that will lead to fallback
          } else {
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
          _dataCallback(false, mockSynchronizer2Data);
          _statusCallback(DataSourceState.Valid, null); // this should lead to recovery
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeInitializerFactory(mockInitializer1)],
    [makeSynchronizerFactory(mockSynchronizer1), makeSynchronizerFactory(mockSynchronizer2)],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let callback;
  await new Promise<void>((resolve) => {
    callback = jest.fn((_: boolean, data: any) => {
      if (data === mockSynchronizer1Data) {
        resolve();
      }
    });

    underTest.start(callback, jest.fn());
  });

  expect(mockInitializer1.start).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer1.start).toHaveBeenCalledTimes(2);
  expect(mockSynchronizer2.start).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledTimes(3);
  expect(callback).toHaveBeenNthCalledWith(1, true, { key: 'init1' });
  expect(callback).toHaveBeenNthCalledWith(2, false, { key: 'sync2' }); // sync1 errors and fallsback
  expect(callback).toHaveBeenNthCalledWith(3, false, { key: 'sync1' }); // sync2 recovers back to sync1
});

it('reports error when all initializers fail', async () => {
  const mockInitializer1Error = {
    name: 'Error',
    message: 'I am initializer1 error!',
  };
  const mockInitializer1: DataSystemInitializer = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Closed, mockInitializer1Error);
        },
      ),
    stop: jest.fn(),
  };

  const mockInitializer2Error = {
    name: 'Error',
    message: 'I am initializer2 error!',
  };
  const mockInitializer2: DataSystemInitializer = {
    start: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: any) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _statusCallback(DataSourceState.Closed, mockInitializer2Error);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeInitializerFactory(mockInitializer1), makeInitializerFactory(mockInitializer2)],
    [], // no synchronizers for this test
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
  expect(statusCallback).toHaveBeenNthCalledWith(
    1,
    DataSourceState.Interrupted,
    mockInitializer1Error,
  );
  expect(statusCallback).toHaveBeenNthCalledWith(
    2,
    DataSourceState.Interrupted,
    mockInitializer2Error,
  );
  expect(statusCallback).toHaveBeenNthCalledWith(3, DataSourceState.Closed, {
    name: 'ExhaustedDataSources',
    message:
      'CompositeDataSource has exhausted all configured datasources (2 initializers, 0 synchronizers).',
  });
  expect(statusCallback).toHaveBeenCalledTimes(3);
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
    [makeInitializerFactory(mockInitializer1)],
    [makeSynchronizerFactory(mockSynchronizer1)], // will continuously fallback onto itself
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  const dataCallback = jest.fn();
  let statusCallback;
  await new Promise<void>((resolve) => {
    statusCallback = jest.fn((state: DataSourceState, _: any) => {
      if (state === DataSourceState.Interrupted) {
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

  expect(statusCallback).toHaveBeenNthCalledWith(
    1,
    DataSourceState.Interrupted,
    mockSynchronizer1Error,
  );
  expect(statusCallback).toHaveBeenNthCalledWith(2, DataSourceState.Closed, undefined);
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
    [makeInitializerFactory(mockInitializer1)],
    [makeSynchronizerFactory(mockSynchronizer1)],
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
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let statusCallback;
  await new Promise<void>((resolve) => {
    statusCallback = jest.fn((_1: DataSourceState, _2: any) => {
      resolve();
    });

    underTest.start(jest.fn(), statusCallback);
  });

  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Closed, {
    name: 'ExhaustedDataSources',
    message:
      'CompositeDataSource has exhausted all configured datasources (0 initializers, 0 synchronizers).',
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
          _dataCallback(false, mockSynchronizer1Data);
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [],
    [makeSynchronizerFactory(mockSynchronizer1)],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let dataCallback;
  await new Promise<void>((resolve) => {
    dataCallback = jest.fn(() => {
      resolve();
    });

    underTest.start(dataCallback, jest.fn());
  });

  expect(dataCallback).toHaveBeenNthCalledWith(1, false, { key: 'sync1' });
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
          _dataCallback(true, { key: 'init1' });
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeInitializerFactory(mockInitializer1)],
    [],
    undefined,
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let dataCallback;
  let statusCallback;
  await new Promise<void>((resolve) => {
    dataCallback = jest.fn();
    statusCallback = jest.fn((_1: DataSourceState, _2: any) => {
      resolve();
    });

    underTest.start(dataCallback, statusCallback);
  });

  expect(dataCallback).toHaveBeenNthCalledWith(1, true, { key: 'init1' });
  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Closed, {
    name: 'ExhaustedDataSources',
    message:
      'CompositeDataSource has exhausted all configured datasources (1 initializers, 0 synchronizers).',
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
          _statusCallback(DataSourceState.Interrupted); // report interrupted to schedule automatic transition and create cancellation token
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeInitializerFactory(mockInitializer1)],
    [makeSynchronizerFactory(mockSynchronizer1)],
    undefined,
    {
      // pass in transition condition of 0 so that it will thrash, generating cancellation tokens repeatedly
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
    statusCallback = jest.fn((_1: DataSourceState, _2: any) => {
      interruptedCount += 1;
      if (interruptedCount > 10) {
        // let it thrash for N iterations
        resolve();
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
