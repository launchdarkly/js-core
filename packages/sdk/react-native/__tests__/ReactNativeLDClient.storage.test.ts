import { AutoEnvAttributes, LDLogger } from '@launchdarkly/js-client-sdk-common';

import ReactNativeLDClient from '../src/ReactNativeLDClient';

it('uses custom storage', async () => {
  // This test just validates that the custom storage instance is being called.
  // Other tests validate how the SDK interacts with storage generally.
  const logger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  const myStorage = {
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
  };
  const client = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Enabled, {
    sendEvents: false,
    initialConnectionMode: 'offline',
    logger,
    storage: myStorage,
  });

  await client.identify({ key: 'potato', kind: 'user' }, { timeout: 15 });
  expect(myStorage.get).toHaveBeenCalled();
  expect(myStorage.clear).not.toHaveBeenCalled();
  // Ensure the base client is not emitting a warning for this.
  expect(logger.warn).not.toHaveBeenCalled();
});
