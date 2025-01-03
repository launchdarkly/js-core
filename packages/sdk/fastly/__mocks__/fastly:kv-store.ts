export const KVStore = jest.fn().mockImplementation(() => ({
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  getMulti: jest.fn(),
  putMulti: jest.fn(),
  deleteMulti: jest.fn(),
}));
