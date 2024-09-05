import { EdgeKV } from '../../src/edgekv/edgekv';
import EdgeKVProvider from '../../src/edgekv/edgeKVProvider';

jest.mock('../../src/edgekv/edgekv', () => ({
  EdgeKV: jest.fn(),
}));

const mockEdgeKV = EdgeKV as jest.Mock;

const NAMESPACE = 'namespace';
const GROUP = 'group';

describe('EdgeKVProvider', () => {
  beforeEach(() => {
    mockEdgeKV.mockImplementation(() => ({
      getText: jest.fn().mockResolvedValue('some-text'),
    }));
  });

  it('get string from edgeKV', async () => {
    const edgeKVProvider = new EdgeKVProvider({ namespace: NAMESPACE, group: GROUP });
    expect(await edgeKVProvider.get('rootKey')).toEqual('some-text');
  });

  it('error getting string from edgeKV', async () => {
    const expectedError = new Error('Error getting string from KV');
    mockEdgeKV.mockImplementation(() => ({
      getText: jest.fn().mockRejectedValueOnce(expectedError),
    }));

    const edgeKVProvider = new EdgeKVProvider({ namespace: NAMESPACE, group: GROUP });
    const result = await edgeKVProvider.get('rootKey');
    expect(result).toBe(undefined);
  });
});
