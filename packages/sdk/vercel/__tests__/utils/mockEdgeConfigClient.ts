import { EdgeConfigClient } from '@vercel/edge-config';

const mockEdgeConfigClient: EdgeConfigClient = {
  get: jest.fn(),
  getAll: jest.fn(),
  digest: jest.fn(),
  has: jest.fn(),
  connection: {
    baseUrl: '',
    id: '',
    token: '',
    version: '',
    type: 'vercel',
  },
};

export default mockEdgeConfigClient;
