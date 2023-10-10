import { Response } from '@common';

const createResponse = (remoteJson: any) => {
  const response: Response = {
    headers: {
      get: jest.fn(),
      keys: jest.fn(),
      values: jest.fn(),
      entries: jest.fn(),
      has: jest.fn(),
    },
    status: 200,
    text: jest.fn(),
    json: () => Promise.resolve(remoteJson),
  };
  return Promise.resolve(response);
};

export default createResponse;
