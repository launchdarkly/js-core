import { LDFeatureStoreItem } from '@launchdarkly/js-server-sdk-common';
import createFeatureStore from './createFeatureStore';

describe('createFeatureStore', () => {
  const mockKV = {
    get: jest.fn(),
  };
  const mockSdkKey = 'mockSdkKey';
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(() => {
    mockKV.get.mockImplementation(() =>
      Promise.resolve({
        flags: {
          testFlagKey: {
            on: true,
          },
        },
        segments: {
          testSegmentKey: {
            name: 'segment-a',
          },
        },
      })
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('get flag', (done) => {
    // @ts-ignore
    const ldFeatureStore = createFeatureStore(mockKV, mockSdkKey, mockLogger);
    const cb = jest.fn((item: LDFeatureStoreItem | null) => {
      expect(item).toEqual({ on: true });
      done();
    });
    ldFeatureStore.get({ namespace: 'features' }, 'testFlagKey', cb);
    expect(mockKV.get).toHaveBeenNthCalledWith(1, `LD-Env-${mockSdkKey}`, { type: 'json' });
  });

  test('get segment', (done) => {
    // @ts-ignore
    const ldFeatureStore = createFeatureStore(mockKV, mockSdkKey, mockLogger);
    const cb = jest.fn((item: LDFeatureStoreItem | null) => {
      expect(item).toEqual({ name: 'segment-a' });
      done();
    });
    ldFeatureStore.get({ namespace: 'segments' }, 'testSegmentKey', cb);
    expect(mockKV.get).toHaveBeenNthCalledWith(1, `LD-Env-${mockSdkKey}`, { type: 'json' });
  });

  test('get error', (done) => {
    // @ts-ignore
    const ldFeatureStore = createFeatureStore(mockKV, mockSdkKey, mockLogger);
    const cb = jest.fn((item: LDFeatureStoreItem | null) => {
      expect(item).toBeNull();
      done();
    });
    ldFeatureStore.get({ namespace: 'features' }, 'invalid', cb);
    expect(mockKV.get).toHaveBeenNthCalledWith(1, `LD-Env-${mockSdkKey}`, { type: 'json' });
  });
});
