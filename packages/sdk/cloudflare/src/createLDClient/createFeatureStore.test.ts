// TODO: fix this
import AsyncStoreFacade from '@launchdarkly/js-server-sdk-common/dist/store/AsyncStoreFacade';
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

  test('get flag', async () => {
    // @ts-ignore
    const ldFeatureStore = new AsyncStoreFacade(createFeatureStore(mockKV, mockSdkKey, mockLogger));
    const flag = await ldFeatureStore.get({ namespace: 'features' }, 'testFlagKey');

    expect(mockKV.get).toHaveBeenNthCalledWith(1, `LD-Env-${mockSdkKey}`, { type: 'json' });
    expect(flag).toEqual({ on: true });
  });

  test('get segment', async () => {
    // @ts-ignore
    const ldFeatureStore = new AsyncStoreFacade(createFeatureStore(mockKV, mockSdkKey, mockLogger));
    const segment = await ldFeatureStore.get({ namespace: 'segments' }, 'testSegmentKey');

    expect(mockKV.get).toHaveBeenNthCalledWith(1, `LD-Env-${mockSdkKey}`, { type: 'json' });
    expect(segment).toEqual({ name: 'segment-a' });
  });

  test('get flag error', async () => {
    // @ts-ignore
    const ldFeatureStore = new AsyncStoreFacade(createFeatureStore(mockKV, mockSdkKey, mockLogger));
    const flag = await ldFeatureStore.get({ namespace: 'features' }, 'invalid');

    expect(mockKV.get).toHaveBeenNthCalledWith(1, `LD-Env-${mockSdkKey}`, { type: 'json' });
    expect(flag).toBeUndefined();
  });

  test('get segment error', async () => {
    // @ts-ignore
    const ldFeatureStore = new AsyncStoreFacade(createFeatureStore(mockKV, mockSdkKey, mockLogger));
    const flag = await ldFeatureStore.get({ namespace: 'segments' }, 'invalid');

    expect(mockKV.get).toHaveBeenNthCalledWith(1, `LD-Env-${mockSdkKey}`, { type: 'json' });
    expect(flag).toBeUndefined();
  });
});
