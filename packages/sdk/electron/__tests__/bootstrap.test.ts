import { readFlagsFromBootstrap } from '../src/bootstrap';
import { goodBootstrapData, goodBootstrapDataWithReasons } from './testBootstrapData';

it('can read valid bootstrap data', () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const readData = readFlagsFromBootstrap(logger, goodBootstrapData);
  expect(readData).toEqual({
    cat: { version: 2, flag: { version: 2, variation: 1, value: false } },
    json: { version: 3, flag: { version: 3, variation: 1, value: ['a', 'b', 'c', 'd'] } },
    killswitch: { version: 5, flag: { version: 5, variation: 0, value: true } },
    'my-boolean-flag': { version: 11, flag: { version: 11, variation: 1, value: false } },
    'string-flag': { version: 3, flag: { version: 3, variation: 1, value: 'is bob' } },
  });
  expect(logger.warn).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

it('can read valid bootstrap data with reasons', () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const readData = readFlagsFromBootstrap(logger, goodBootstrapDataWithReasons);
  expect(readData.cat).toEqual({
    version: 2,
    flag: {
      version: 2,
      variation: 1,
      value: false,
      reason: { kind: 'OFF' },
    },
  });
  expect(readData.killswitch.flag.reason).toEqual({ kind: 'FALLTHROUGH' });
  expect(logger.warn).not.toHaveBeenCalled();
});

it('can read old bootstrap data without $flagsState', () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const oldData: any = { ...goodBootstrapData };
  delete oldData.$flagsState;

  const readData = readFlagsFromBootstrap(logger, oldData);
  expect(readData).toEqual({
    cat: { version: 0, flag: { version: 0, value: false } },
    json: { version: 0, flag: { version: 0, value: ['a', 'b', 'c', 'd'] } },
    killswitch: { version: 0, flag: { version: 0, value: true } },
    'my-boolean-flag': { version: 0, flag: { version: 0, value: false } },
    'string-flag': { version: 0, flag: { version: 0, value: 'is bob' } },
  });
  expect(logger.warn).toHaveBeenCalledWith(
    'LaunchDarkly client was initialized with bootstrap data that did not include flag' +
      ' metadata. Events may not be sent correctly.',
  );
});

it('can handle invalid bootstrap data with $valid false', () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const invalid: any = { $valid: false, $flagsState: {} };

  const readData = readFlagsFromBootstrap(logger, invalid);
  expect(readData).toEqual({});
  expect(logger.warn).toHaveBeenCalledWith(
    'LaunchDarkly bootstrap data is not available because the back end could not read the flags.',
  );
});
