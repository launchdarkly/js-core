import type { KVNamespace } from '@cloudflare/workers-types';

const mockKV: KVNamespace<string> = {
  get: jest.fn(),
  list: jest.fn(),
  put: jest.fn(),
  getWithMetadata: jest.fn(),
  delete: jest.fn(),
};

export default mockKV;
