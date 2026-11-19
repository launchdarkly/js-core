import type { LDElectronStorage } from '../src';

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
