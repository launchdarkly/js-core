import { AsyncStoreFacade, LDFeatureStore } from '@launchdarkly/js-server-sdk-common';

import { EdgeFeatureStore } from '../../src/api/EdgeFeatureStore';
import mockEdgeProvider from '../utils/mockEdgeProvider';
import * as testData from './testData.json';

describe('EdgeFeatureStore', () => {
  const clientSideId = 'client-side-id';
  const kvKey = `LD-Env-${clientSideId}`;
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  const mockGet = mockEdgeProvider.get as jest.Mock;
  let featureStore: LDFeatureStore;
  let asyncFeatureStore: AsyncStoreFacade;

  beforeEach(() => {
    mockGet.mockImplementation(() => Promise.resolve(JSON.stringify(testData)));
    featureStore = new EdgeFeatureStore(
      mockEdgeProvider,
      clientSideId,
      'MockEdgeProvider',
      mockLogger,
    );
    asyncFeatureStore = new AsyncStoreFacade(featureStore);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('get', () => {
    it('can retrieve valid flag', async () => {
      const flag = await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');

      expect(mockGet).toHaveBeenCalledWith(kvKey);
      expect(flag).toMatchObject(testData.flags.testFlag1);
    });

    it('returns undefined for invalid flag key', async () => {
      const flag = await asyncFeatureStore.get({ namespace: 'features' }, 'invalid');

      expect(flag).toBeUndefined();
    });

    it('can retrieve valid segment', async () => {
      const segment = await asyncFeatureStore.get({ namespace: 'segments' }, 'testSegment1');

      expect(mockGet).toHaveBeenCalledWith(kvKey);
      expect(segment).toMatchObject(testData.segments.testSegment1);
    });

    it('returns undefined for invalid segment key', async () => {
      const segment = await asyncFeatureStore.get({ namespace: 'segments' }, 'invalid');

      expect(segment).toBeUndefined();
    });

    it('returns null for invalid kv key', async () => {
      mockGet.mockImplementation(() => Promise.resolve(null));
      const flag = await asyncFeatureStore.get({ namespace: 'features' }, 'testFlag1');

      expect(flag).toBeNull();
    });
  });

  describe('all', () => {
    it('can retrieve all flags', async () => {
      const flags = await asyncFeatureStore.all({ namespace: 'features' });

      expect(mockGet).toHaveBeenCalledWith(kvKey);
      expect(flags).toMatchObject(testData.flags);
    });

    it('can retrieve all segments', async () => {
      const segment = await asyncFeatureStore.all({ namespace: 'segments' });

      expect(mockGet).toHaveBeenCalledWith(kvKey);
      expect(segment).toMatchObject(testData.segments);
    });

    it('returns empty object for invalid DataKind', async () => {
      const flag = await asyncFeatureStore.all({ namespace: 'InvalidDataKind' });

      expect(flag).toEqual({});
    });

    it('returns empty object for invalid kv key', async () => {
      mockGet.mockImplementation(() => Promise.resolve(null));
      const segment = await asyncFeatureStore.all({ namespace: 'segments' });

      expect(segment).toEqual({});
    });
  });

  describe('initialized', () => {
    it('returns true when initialized', async () => {
      const isInitialized = await asyncFeatureStore.initialized();

      expect(mockGet).toHaveBeenCalledWith(kvKey);
      expect(isInitialized).toBeTruthy();
    });

    it('returns false when not initialized', async () => {
      mockGet.mockImplementation(() => Promise.resolve(null));
      const isInitialized = await asyncFeatureStore.initialized();

      expect(mockGet).toHaveBeenCalledWith(kvKey);
      expect(isInitialized).toBeFalsy();
    });
  });

  describe('init & getDescription', () => {
    it('can initialize', (done) => {
      const cb = jest.fn(() => {
        done();
      });
      featureStore.init(testData, cb);
    });

    it('can retrieve description', async () => {
      const description = featureStore.getDescription?.();

      expect(description).toEqual('MockEdgeProvider');
    });
  });
});
