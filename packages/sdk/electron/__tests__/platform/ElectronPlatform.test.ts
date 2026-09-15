import type { LDLogger } from '@launchdarkly/js-client-sdk-common';

import ElectronInfo from '../../src/platform/ElectronInfo';
import ElectronPlatform from '../../src/platform/ElectronPlatform';
import ElectronRequests from '../../src/platform/ElectronRequests';
import { getElectronStorage } from '../../src/platform/ElectronStorage';

const storageInstance = { get: jest.fn(), set: jest.fn(), clear: jest.fn() };

jest.mock('../../src/platform/ElectronStorage', () => ({
  getElectronStorage: jest.fn(() => storageInstance),
}));
jest.mock('../../src/platform/ElectronInfo');
jest.mock('../../src/platform/ElectronRequests');

const logger: LDLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('uses the shared ElectronStorage singleton, passing the logger through', () => {
  const platform = new ElectronPlatform(logger, {});

  expect(getElectronStorage).toHaveBeenCalledWith(logger);
  expect(platform.storage).toBe(storageInstance);
});

it('threads wrapperName/wrapperVersion into ElectronInfo', () => {
  // eslint-disable-next-line no-new
  new ElectronPlatform(logger, { wrapperName: 'my-wrapper', wrapperVersion: '1.2.3' });

  expect(ElectronInfo).toHaveBeenCalledWith({
    wrapperName: 'my-wrapper',
    wrapperVersion: '1.2.3',
  });
});

it('constructs ElectronRequests with enableEventCompression', () => {
  // eslint-disable-next-line no-new
  new ElectronPlatform(logger, {
    enableEventCompression: true,
  });

  expect(ElectronRequests).toHaveBeenCalledWith(true);
});
