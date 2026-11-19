import type { LDElectronStorage, LDIdentifyOptions } from '../src';

it('exports the LDElectronStorage type for custom storage implementations', () => {
  const storage: LDElectronStorage = {
    get: async () => null,
    set: async () => undefined,
    clear: async () => undefined,
  };

  expect(typeof storage.get).toBe('function');
  expect(typeof storage.set).toBe('function');
  expect(typeof storage.clear).toBe('function');
});

it('exports an LDIdentifyOptions type that carries a secure mode hash', () => {
  const identifyOptions: LDIdentifyOptions = { hash: 'secure-hash' };

  expect(identifyOptions.hash).toBe('secure-hash');
});
