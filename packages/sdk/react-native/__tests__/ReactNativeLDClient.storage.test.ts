import { AutoEnvAttributes, LDLogger } from '@launchdarkly/js-client-sdk-common';

import PlatformStorage from '../src/platform/PlatformStorage';
import ReactNativeLDClient from '../src/ReactNativeLDClient';

jest.mock('../src/platform/PlatformStorage', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((logger: LDLogger) => {
    const ActualPlatformStorage = jest.requireActual('../src/platform/PlatformStorage').default;
    return new ActualPlatformStorage(logger);
  }),
}));

describe('ReactNativeLDClient storage', () => {
  beforeEach(() => {
    (PlatformStorage as jest.MockedClass<typeof PlatformStorage>).mockClear();
  });

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
    // Ensure the default platform storage is not instantiated when custom storage is provided.
    expect(PlatformStorage).not.toHaveBeenCalled();
  });

  it('uses default platform storage when no custom storage is provided', async () => {
    const logger: LDLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const client = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Enabled, {
      sendEvents: false,
      initialConnectionMode: 'offline',
      logger,
    });

    // Verify that PlatformStorage was instantiated
    expect(PlatformStorage).toHaveBeenCalledWith(logger);
    expect(PlatformStorage).toHaveBeenCalledTimes(1);

    // Get the storage instance and spy on its methods
    const mockResults = (PlatformStorage as jest.MockedClass<typeof PlatformStorage>).mock.results;
    expect(mockResults.length).toBeGreaterThan(0);
    const storageInstance = mockResults[0].value;
    expect(storageInstance).toBeDefined();

    const getSpy = jest.spyOn(storageInstance, 'get');
    const setSpy = jest.spyOn(storageInstance, 'set');

    await client.identify({ key: 'potato', kind: 'user' }, { timeout: 15 });

    // Verify that storage methods are being called
    expect(getSpy).toHaveBeenCalled();
    expect(setSpy).toHaveBeenCalled();

    getSpy.mockRestore();
    setSpy.mockRestore();
  });
});
