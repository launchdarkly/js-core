jest.mock('../edgekv/edgekv', () => ({
  EdgeKV: jest.fn(),
}));

import EdgeKVProvider from '../edgekv/edgeKVProvider';
import { EdgeKV } from '../edgekv/edgekv';

const mockEdgeKV = EdgeKV as jest.Mock;

const NAMESPACE = 'namespace';
const GROUP = 'group';

describe('EdgeKVProvider', () => {
  beforeEach(() => {
    mockEdgeKV.mockImplementation(() => {
      return {
        getText: jest.fn().mockResolvedValue('some-text'),
      };
    });
  });

  it('get string from edgeKV', async () => {
    const edgeKVProvider = new EdgeKVProvider({ namespace: NAMESPACE, group: GROUP });
    expect(await edgeKVProvider.get('rootKey')).toEqual('some-text');
  });

  it('error getting string from edgeKV', async () => {
    const expectedError = new Error('Error getting string from KV');
    mockEdgeKV.mockImplementation(() => {
      return {
        getText: jest.fn().mockRejectedValueOnce(expectedError),
      };
    });

    const edgeKVProvider = new EdgeKVProvider({ namespace: NAMESPACE, group: GROUP });
    const result = await edgeKVProvider.get('rootKey');
    expect(result).toBe(undefined);
  });
});
