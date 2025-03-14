import {
  CompositeDataSource,
  TransitionConditions,
} from '../../../src/api/subsystem/DataSystem/CompositeDataSource';
import {
  Data,
  DataSourceState,
  DataSystemInitializer,
  DataSystemSynchronizer,
  InitializerFactory,
  SynchronizerFactory,
} from '../../../src/api/subsystem/DataSystem/DataSource';
import { Backoff } from '../../../src/datasource/Backoff';

function makeInitializerFactory(internal: DataSystemInitializer): InitializerFactory {
  return {
    create: () => internal,
  };
}

function makeSynchronizerFactory(internal: DataSystemSynchronizer): SynchronizerFactory {
  return {
    create: () => internal,
  };
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
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _dataCallback(true, { key: 'init1' });
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer1Data = { key: 'sync1' };
  const mockSynchronizer1 = {
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
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
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let callback;
  await new Promise<void>((resolve) => {
    callback = jest.fn((_: boolean, data: Data) => {
      if (data === mockSynchronizer1Data) {
        resolve();
      }
    });

    underTest.run(callback, jest.fn());
  });

  expect(mockInitializer1.run).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer1.run).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledTimes(2);
  expect(callback).toHaveBeenNthCalledWith(1, true, { key: 'init1' });
  expect(callback).toHaveBeenNthCalledWith(2, false, { key: 'sync1' });
});

it('handles initializer getting basis, switches to synchronizer 1, falls back to synchronizer 2, recovers to synchronizer 1', async () => {
  const mockInitializer1: DataSystemInitializer = {
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
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
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          if (sync1RunCount === 0) {
            _statusCallback(DataSourceState.Closed, {
              name: 'Error',
              message: 'I am error...man!',
            }); // error that will lead to fallback
          } else {
            _dataCallback(false, mockSynchronizer1Data); // second run will lead to data
          }
          sync1RunCount += 1;
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer2Data = { key: 'sync2' };
  const mockSynchronizer2 = {
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
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
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let callback;
  await new Promise<void>((resolve) => {
    callback = jest.fn((_: boolean, data: Data) => {
      if (data === mockSynchronizer1Data) {
        resolve();
      }
    });

    underTest.run(callback, jest.fn());
  });

  expect(mockInitializer1.run).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer1.run).toHaveBeenCalledTimes(2);
  expect(mockSynchronizer2.run).toHaveBeenCalledTimes(1);
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
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
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
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
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

    underTest.run(dataCallback, statusCallback);
  });

  expect(mockInitializer1.run).toHaveBeenCalledTimes(1);
  expect(mockInitializer2.run).toHaveBeenCalledTimes(1);
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
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _dataCallback(true, { key: 'init1' });
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer1Error = { name: 'Error', message: 'I am error...man!' };
  const mockSynchronizer1 = {
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
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

    underTest.run(dataCallback, statusCallback);
  });

  expect(mockInitializer1.run).toHaveBeenCalled();
  expect(mockSynchronizer1.run).toHaveBeenCalled();
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
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
          _statusCallback: (status: DataSourceState, err?: any) => void,
        ) => {
          _dataCallback(true, mockInitializer1Data);
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer1Data = { key: 'sync1' };
  const mockSynchronizer1 = {
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
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
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let callback1;
  await new Promise<void>((resolve) => {
    callback1 = jest.fn((_: boolean, data: Data) => {
      if (data === mockSynchronizer1Data) {
        underTest.stop();
        resolve();
      }
    });
    // first run
    underTest.run(callback1, jest.fn());
  });

  // check first run triggered underlying data sources
  expect(mockInitializer1.run).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer1.run).toHaveBeenCalledTimes(1);
  expect(callback1).toHaveBeenCalledTimes(2);

  // wait a moment for pending awaits to resolve the stop request
  await new Promise((f) => {
    setTimeout(f, 1);
  });

  let callback2;
  await new Promise<void>((resolve) => {
    callback2 = jest.fn((_: boolean, data: Data) => {
      if (data === mockSynchronizer1Data) {
        resolve();
      }
    });
    // second run
    underTest.run(callback2, jest.fn());
  });

  // check that second run triggers underlying data sources again
  expect(mockInitializer1.run).toHaveBeenCalledTimes(2);
  expect(mockSynchronizer1.run).toHaveBeenCalledTimes(2);
  expect(callback2).toHaveBeenCalledTimes(2);
});

it('is well behaved with no initializers and no synchronizers configured', async () => {
  const underTest = new CompositeDataSource(
    [],
    [],
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let statusCallback;
  await new Promise<void>((resolve) => {
    statusCallback = jest.fn((_1: DataSourceState, _2: any) => {
      resolve();
    });

    underTest.run(jest.fn(), statusCallback);
  });

  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Closed, {
    name: 'ExhaustedDataSources',
    message:
      'CompositeDataSource has exhausted all configured datasources (0 initializers, 0 synchronizers).',
  });
});

it('is well behaved with an initializer and no synchronizers configured', async () => {
  const mockInitializer1 = {
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
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
    makeTestTransitionConditions(),
    makeZeroBackoff(),
  );

  let statusCallback;
  await new Promise<void>((resolve) => {
    statusCallback = jest.fn((_1: DataSourceState, _2: any) => {
      resolve();
    });

    underTest.run(jest.fn(), statusCallback);
  });

  expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Closed, {
    name: 'ExhaustedDataSources',
    message:
      'CompositeDataSource has exhausted all configured datasources (1 initializers, 0 synchronizers).',
  });
});
