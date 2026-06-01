import type { LDStorage } from '../../src/client';
import type { LDReactClientOptions } from '../../src/client/LDOptions';

it('accepts a custom storage override on the react client options', () => {
  const storage: LDStorage = {
    get: async () => null,
    set: async () => {},
    clear: async () => {},
  };

  const options: LDReactClientOptions = { storage };

  expect(options.storage).toBe(storage);
});
