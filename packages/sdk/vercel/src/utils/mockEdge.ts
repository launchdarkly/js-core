import { EdgeConfigClient } from '@vercel/edge-config';

const mockEdge: EdgeConfigClient = {
  get: jest.fn(),
  getAll: jest.fn(),
  digest: jest.fn(),
  has: jest.fn(),
};

export default mockEdge;
