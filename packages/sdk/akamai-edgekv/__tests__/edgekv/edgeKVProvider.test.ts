import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { EdgeKV } from '../../src/edgekv/edgekv';
import EdgeKVProvider from '../../src/edgekv/edgeKVProvider';

jest.mock('../../src/edgekv/edgekv', () => ({
  EdgeKV: jest.fn(),
}));

const mockEdgeKV = EdgeKV as jest.Mock;

const NAMESPACE = 'namespace';
const GROUP = 'group';

describe('EdgeKVProvider', () => {
  let logger: LDLogger;
  beforeEach(() => {
    mockEdgeKV.mockImplementation(() => ({
      getText: jest.fn().mockResolvedValue('some-text'),
    }));
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  it('get string from edgeKV', async () => {
    const edgeKVProvider = new EdgeKVProvider({ namespace: NAMESPACE, group: GROUP, logger });
    expect(await edgeKVProvider.get('rootKey')).toEqual('some-text');
  });

  it('error getting string from edgeKV', async () => {
    const expectedError = new Error('Error getting string from KV');
    mockEdgeKV.mockImplementation(() => ({
      getText: jest.fn().mockRejectedValueOnce(expectedError),
    }));

    const edgeKVProvider = new EdgeKVProvider({ namespace: NAMESPACE, group: GROUP, logger });
    const result = await edgeKVProvider.get('rootKey');
    expect(result).toBe(undefined);
  });
});
