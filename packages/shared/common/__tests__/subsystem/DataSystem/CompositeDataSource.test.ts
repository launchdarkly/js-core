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

// TODO: go through tests and tune status reporting to verify composite data source is correctly coalescing/masking status during transitions.

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
          _statusCallback(DataSourceState.Off, {
            name: 'Error',
            message: 'I am an unrecoverable error!', // error will lead to culling
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
    message:
      'CompositeDataSource has exhausted all configured datasources (2 initializers, 0 synchronizers).',
  });
  expect(statusCallback).toHaveBeenCalledTimes(4);
});

// it('it reports DataSourceState Off when all synchronizers report Off', async () => {
//   const mockInitializer1: DataSource = {
//     start: jest
//       .fn()
//       .mockImplementation(
//         (
//           _dataCallback: (basis: boolean, data: any) => void,
//           _statusCallback: (status: DataSourceState, err?: any) => void,
//         ) => {
//           _statusCallback(DataSourceState.Initializing);
//           _statusCallback(DataSourceState.Valid);
//           _dataCallback(true, { key: 'init1' });
//           _statusCallback(DataSourceState.Closed);
//         },
//       ),
//     stop: jest.fn(),
//   };

//   const mockSynchronizer1 = {
//     start: jest
//       .fn()
//       .mockImplementation(
//         (
//           _dataCallback: (basis: boolean, data: any) => void,
//           _statusCallback: (status: DataSourceState, err?: any) => void,
//         ) => {
//           _statusCallback(DataSourceState.Initializing);
//           _statusCallback(DataSourceState.Off, {
//             name: 'Error1',
//             message: 'I am an unrecoverable error!',
//           });
//         },
//       ),
//     stop: jest.fn(),
//   };

//   const mockSynchronizer2 = {
//     start: jest
//       .fn()
//       .mockImplementation(
//         (
//           _dataCallback: (basis: boolean, data: any) => void,
//           _statusCallback: (status: DataSourceState, err?: any) => void,
//         ) => {
//           _statusCallback(DataSourceState.Initializing);
//           _statusCallback(DataSourceState.Off, {
//             name: 'Error2',
//             message: 'I am an unrecoverable error!',
//           });
//         },
//       ),
//     stop: jest.fn(),
//   };

//   const underTest = new CompositeDataSource(
//     [makeDataSourceFactory(mockInitializer1)],
//     [makeDataSourceFactory(mockSynchronizer1), makeDataSourceFactory(mockSynchronizer2)],
//     undefined,
//     makeTestTransitionConditions(),
//     makeZeroBackoff(),
//   );

//   let statusCallback;
//   await new Promise<void>((resolve) => {
//     statusCallback = jest.fn((state: DataSourceState, err: any) => {
//       if (err && err.name === 'Error2') {
//         resolve();
//       }
//     });

//     underTest.start(jest.fn(), statusCallback);
//   });

//   expect(mockInitializer1.start).toHaveBeenCalledTimes(1);
//   expect(mockSynchronizer1.start).toHaveBeenCalledTimes(1);
//   expect(mockSynchronizer2.start).toHaveBeenCalledTimes(1);
//   expect(statusCallback).toHaveBeenNthCalledWith(1, DataSourceState.Initializing, null);
//   expect(statusCallback).toHaveBeenNthCalledWith(2, DataSourceState.Valid, null);
//   expect(statusCallback).toHaveBeenNthCalledWith(3, DataSourceState.Interrupted, expect.anything());
//   expect(statusCallback).toHaveBeenNthCalledWith(4, DataSourceState.Off, null);
// });

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
          _statusCallback(DataSourceState.Valid);
          _statusCallback(DataSourceState.Interrupted); // report interrupted to schedule automatic transition and create cancellation token
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeDataSourceFactory(mockInitializer1)],
    [makeDataSourceFactory(mockSynchronizer1)],
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
