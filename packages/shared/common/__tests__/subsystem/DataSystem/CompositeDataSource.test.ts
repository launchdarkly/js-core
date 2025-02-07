import { CompositeDataSource } from '../../../src/api/subsystem/DataSystem/CompositeDataSource';
import { Data, HealthStatus } from '../../../src/api/subsystem/DataSystem/DataSource';
import {
  DataSystemInitializer,
  InitializerFactory,
} from '../../../src/api/subsystem/DataSystem/DataSystemInitializer';
import {
  DataSystemSynchronizer,
  SynchronizerFactory,
} from '../../../src/api/subsystem/DataSystem/DataSystemSynchronizer';

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

it('initializer gets basis, switch to syncrhonizer', async () => {
  const mockInitializer1 = {
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
          _statusCallback: (status: HealthStatus, durationMS: number) => void,
          _errorHander: (err: Error) => void,
        ) => {
          _dataCallback(true, { key: 'init1' });
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer1 = {
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
          _statusCallback: (status: HealthStatus, durationMS: number) => void,
          _errorHander: (err: Error) => void,
        ) => {
          _dataCallback(false, { key: 'sync1' });
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeInitializerFactory(mockInitializer1)],
    [makeSynchronizerFactory(mockSynchronizer1)],
  );
  const callback = jest.fn();
  underTest.run(callback, jest.fn());

  // pause so scheduler can resolve awaits
  await new Promise((f) => {
    setTimeout(f, 1);
  });

  expect(mockInitializer1.run).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer1.run).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledTimes(2);
  expect(callback).toHaveBeenNthCalledWith(1, true, { key: 'init1' });
  expect(callback).toHaveBeenNthCalledWith(2, false, { key: 'sync1' });
});

it('initializer gets basis, switch to synchronizer 1, fallback to synchronizer 2, recover to synchronizer 1', async () => {
  const mockInitializer1: DataSystemInitializer = {
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
          _statusCallback: (status: HealthStatus, durationMS: number) => void,
          _errorHander: (err: Error) => void,
        ) => {
          _dataCallback(true, { key: 'init1' });
        },
      ),
    stop: jest.fn(),
  };

  let sync1RunCount = 0;
  const mockSynchronizer1 = {
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
          _statusCallback: (status: HealthStatus, durationMS: number) => void,
          _errorHander: (err: Error) => void,
        ) => {
          if (sync1RunCount === 0) {
            _errorHander({ name: 'Error', message: 'I am error...man!' }); // error that will lead to fallback
          } else {
            _dataCallback(false, { key: 'sync1' }); // second run will lead to data
          }
          sync1RunCount += 1;
        },
      ),
    stop: jest.fn(),
  };

  const mockSynchronizer2 = {
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
          _statusCallback: (status: HealthStatus, durationMS: number) => void,
          _errorHander: (err: Error) => void,
        ) => {
          _dataCallback(false, { key: 'sync2' });
          _statusCallback(HealthStatus.Online, Number.MAX_VALUE); // this should lead to recovery
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeInitializerFactory(mockInitializer1)],
    [makeSynchronizerFactory(mockSynchronizer1), makeSynchronizerFactory(mockSynchronizer2)],
  );
  const callback = jest.fn();
  underTest.run(callback, jest.fn());

  // pause so scheduler can resolve awaits
  await new Promise((f) => {
    setTimeout(f, 1);
  });
  expect(mockInitializer1.run).toHaveBeenCalledTimes(1);
  expect(mockSynchronizer1.run).toHaveBeenCalledTimes(2);
  expect(mockSynchronizer2.run).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledTimes(3);
  expect(callback).toHaveBeenNthCalledWith(1, true, { key: 'init1' });
  expect(callback).toHaveBeenNthCalledWith(2, false, { key: 'sync2' }); // sync1 errors and fallsback
  expect(callback).toHaveBeenNthCalledWith(3, false, { key: 'sync1' }); // sync2 recovers back to sync1
});

it('it reports error when all initializers fail', async () => {
  const mockInitializer1: DataSystemInitializer = {
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
          _statusCallback: (status: HealthStatus, durationMS: number) => void,
          _errorHander: (err: Error) => void,
        ) => {
          _errorHander({ name: 'Error', message: 'I am initializer1 error!' });
        },
      ),
    stop: jest.fn(),
  };

  const mockInitializer2: DataSystemInitializer = {
    run: jest
      .fn()
      .mockImplementation(
        (
          _dataCallback: (basis: boolean, data: Data) => void,
          _statusCallback: (status: HealthStatus, durationMS: number) => void,
          _errorHander: (err: Error) => void,
        ) => {
          _errorHander({ name: 'Error', message: 'I am initializer2 error!' });
        },
      ),
    stop: jest.fn(),
  };

  const underTest = new CompositeDataSource(
    [makeInitializerFactory(mockInitializer1), makeInitializerFactory(mockInitializer2)],
    [], // no synchronizers for this test
  );

  const dataCallback = jest.fn();
  const errorCallback = jest.fn();
  underTest.run(dataCallback, errorCallback);

  // pause so scheduler can resolve awaits
  await new Promise((f) => {
    setTimeout(f, 1);
  });

  expect(mockInitializer1.run).toHaveBeenCalledTimes(1);
  expect(mockInitializer2.run).toHaveBeenCalledTimes(1);
  expect(dataCallback).toHaveBeenCalledTimes(0);
  expect(errorCallback).toHaveBeenCalledTimes(3);
  expect(errorCallback).toHaveBeenNthCalledWith(1, {
    name: 'Error',
    message: 'I am initializer1 error!',
  });
  expect(errorCallback).toHaveBeenNthCalledWith(2, {
    name: 'Error',
    message: 'I am initializer2 error!',
  });
  expect(errorCallback).toHaveBeenNthCalledWith(3, {
    name: 'ExhaustedDataSources',
    message: 'CompositeDataSource has exhausted all configured datasources.',
  });
});
