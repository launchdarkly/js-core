/// <reference types="@fastly/js-compute" />
import { KVStore } from 'fastly:kv-store';

import { LDClient } from '../src/api';
import { init } from '../src/index';
import * as testData from './utils/testData.json';

// Tell Jest to use the manual mock
jest.mock('fastly:kv-store');

const sdkKey = 'test-sdk-key';
const flagKey1 = 'testFlag1';
const flagKey2 = 'testFlag2';
const flagKey3 = 'testFlag3';
const context = { kind: 'user', key: 'test-user-key-1' };

describe('init', () => {
  let ldClient: LDClient;
  let mockKVStore: jest.Mocked<KVStore>;

  beforeAll(async () => {
    mockKVStore = new KVStore('test-kv-store') as jest.Mocked<KVStore>;
    const testDataString = JSON.stringify(testData);

    mockKVStore.get.mockResolvedValue({
      text: jest.fn().mockResolvedValue(testDataString),
      json: jest.fn().mockResolvedValue(testData),
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
      body: new ReadableStream(),
      bodyUsed: false,
      metadata: () => null,
      metadataText: () => null,
    });
    ldClient = init(sdkKey, mockKVStore);
    await ldClient.waitForInitialization();
  });

  afterAll(() => {
    ldClient.close();
  });

  describe('flag tests', () => {
    it('evaluates a boolean flag with a variation call', async () => {
      const value = await ldClient.variation(flagKey1, context, false);
      expect(value).toBeTruthy();
    });

    it('evaluates a boolean flag with a variation and variation detail call', async () => {
      const contextWithEmail = { ...context, email: 'test@yahoo.com' };
      const value = await ldClient.variation(flagKey2, contextWithEmail, false);
      const detail = await ldClient.variationDetail(flagKey2, contextWithEmail, false);

      expect(detail).toEqual({ reason: { kind: 'FALLTHROUGH' }, value: true, variationIndex: 0 });
      expect(value).toBeTruthy();
    });

    it('evaluates a boolean flag with a targeting rule match', async () => {
      const contextWithEmail = { ...context, email: 'test@gmail.com' };
      const value = await ldClient.variation(flagKey1, contextWithEmail, false);
      const detail = await ldClient.variationDetail(flagKey1, contextWithEmail, false);

      expect(detail).toEqual({
        reason: { kind: 'RULE_MATCH', ruleId: 'rule1', ruleIndex: 0 },
        value: false,
        variationIndex: 1,
      });
      expect(value).toBeFalsy();
    });

    it('evaluates a feature flag with a context that does not match any targeting rules', async () => {
      const contextWithEmail = { ...context, email: 'test@yahoo.com' };
      const value = await ldClient.variation(flagKey1, contextWithEmail, false);
      const detail = await ldClient.variationDetail(flagKey1, contextWithEmail, false);

      expect(detail).toEqual({ reason: { kind: 'FALLTHROUGH' }, value: true, variationIndex: 0 });
      expect(value).toBeTruthy();
    });

    it('returns allFlagsState for a context', async () => {
      const allFlags = await ldClient.allFlagsState(context);

      expect(allFlags).toBeDefined();
      expect(allFlags.toJSON()).toEqual({
        $flagsState: {
          testFlag1: { debugEventsUntilDate: 2000, variation: 0, version: 2 },
          testFlag2: { debugEventsUntilDate: 2000, variation: 0, version: 2 },
          testFlag3: { debugEventsUntilDate: 2000, variation: 0, version: 2 },
        },
        $valid: true,
        testFlag1: true,
        testFlag2: true,
        testFlag3: true,
      });
    });
  });

  describe('segment tests', () => {
    it('evaluates a boolean flag with a segment targeting rule match', async () => {
      const contextWithCountry = { ...context, country: 'australia' };
      const value = await ldClient.variation(flagKey3, contextWithCountry, false);
      const detail = await ldClient.variationDetail(flagKey3, contextWithCountry, false);

      expect(detail).toEqual({
        reason: { kind: 'RULE_MATCH', ruleId: 'rule1', ruleIndex: 0 },
        value: false,
        variationIndex: 1,
      });
      expect(value).toBeFalsy();
    });
  });
});
