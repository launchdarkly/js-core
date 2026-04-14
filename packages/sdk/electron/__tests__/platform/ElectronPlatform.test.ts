import type { LDLogger } from '@launchdarkly/js-client-sdk-common';

import ElectronPlatform from '../../src/platform/ElectronPlatform';

const failingStorage = {
  get: jest.fn().mockRejectedValue(new Error('disk read failed')),
  set: jest.fn().mockRejectedValue(new Error('disk write failed')),
  clear: jest.fn().mockRejectedValue(new Error('disk clear failed')),
};

jest.mock('../../src/platform/ElectronStorage', () => ({
  getElectronStorage: () => failingStorage,
}));

const logger: LDLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

let platform: ElectronPlatform;

beforeEach(() => {
  jest.clearAllMocks();
  platform = new ElectronPlatform(logger, {});
});

it('logs error and returns null when storage get fails', async () => {
  const result = await platform.storage!.get('some-key');

  expect(result).toBeNull();
  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Error getting key from storage: some-key'),
  );
});

it('logs error and swallows when storage set fails', async () => {
  await platform.storage!.set('some-key', 'some-value');

  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Error setting key in storage: some-key'),
  );
});

it('logs error and swallows when storage clear fails', async () => {
  await platform.storage!.clear('some-key');

  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Error clearing key from storage: some-key'),
  );
});
