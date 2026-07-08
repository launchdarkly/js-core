import { createChromeStorageAdapter } from '../../src/storage/chromeStorageAdapter';

function makeFakeStorageArea() {
  const store: Record<string, unknown> = {};
  return {
    store,
    get: jest.fn(async (key: string) => (key in store ? { [key]: store[key] } : {})),
    set: jest.fn(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    }),
    remove: jest.fn(async (key: string) => {
      delete store[key];
    }),
  };
}

it('returns the stored string value for a known key', async () => {
  const area = makeFakeStorageArea();
  area.store['ld-key'] = 'cached-value';
  const adapter = createChromeStorageAdapter(area as unknown as chrome.storage.StorageArea);

  await expect(adapter.get('ld-key')).resolves.toEqual('cached-value');
  expect(area.get).toHaveBeenCalledWith('ld-key');
});

it('returns null when the key is absent', async () => {
  const area = makeFakeStorageArea();
  const adapter = createChromeStorageAdapter(area as unknown as chrome.storage.StorageArea);

  await expect(adapter.get('missing')).resolves.toBeNull();
});

it('returns null when the stored value is not a string', async () => {
  const area = makeFakeStorageArea();
  area.store['ld-key'] = { not: 'a string' };
  const adapter = createChromeStorageAdapter(area as unknown as chrome.storage.StorageArea);

  await expect(adapter.get('ld-key')).resolves.toBeNull();
});

it('writes a key/value pair on set', async () => {
  const area = makeFakeStorageArea();
  const adapter = createChromeStorageAdapter(area as unknown as chrome.storage.StorageArea);

  await adapter.set('ld-key', 'v1');
  expect(area.set).toHaveBeenCalledWith({ 'ld-key': 'v1' });
  await expect(adapter.get('ld-key')).resolves.toEqual('v1');
});

it('removes a key on clear', async () => {
  const area = makeFakeStorageArea();
  area.store['ld-key'] = 'v1';
  const adapter = createChromeStorageAdapter(area as unknown as chrome.storage.StorageArea);

  await adapter.clear('ld-key');
  expect(area.remove).toHaveBeenCalledWith('ld-key');
  await expect(adapter.get('ld-key')).resolves.toBeNull();
});
