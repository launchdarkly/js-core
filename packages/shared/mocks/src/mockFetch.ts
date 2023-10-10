import { Response } from '@common';

import basicPlatform from './platform';

const createMockResponse = (remoteJson: any, statusCode: number) => {
  const response: Response = {
    headers: {
      get: jest.fn(),
      keys: jest.fn(),
      values: jest.fn(),
      entries: jest.fn(),
      has: jest.fn(),
    },
    status: statusCode,
    text: jest.fn(),
    json: () => Promise.resolve(remoteJson),
  };
  return Promise.resolve(response);
};

/**
 * Mocks basicPlatform fetch. Returns the fetch jest.Mock object.
 * @param remoteJson
 * @param statusCode
 */
const mockFetch = (remoteJson: any, statusCode: number = 200): jest.Mock => {
  const f = basicPlatform.requests.fetch as jest.Mock;
  f.mockResolvedValue(createMockResponse(remoteJson, statusCode));
  return f;
};

export default mockFetch;
