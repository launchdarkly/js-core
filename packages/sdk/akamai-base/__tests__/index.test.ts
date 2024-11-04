import { EdgeProvider, init } from '../src/index';
import * as testData from './testData.json';

const sdkKey = 'test-sdk-key';
const flagKey1 = 'testFlag1';
const flagKey2 = 'testFlag2';
const flagKey3 = 'testFlag3';
const context: any = { kind: 'user', key: 'test-user-key-1' };

class FeatureStore implements EdgeProvider {
  async get(): Promise<string> {
    return Promise.resolve(JSON.stringify(testData));
  }
}

describe('init', () => {
  let ldClient: any;
  const mockFeatureStore = new FeatureStore();

  describe('init with own feature store', () => {
    beforeAll(async () => {
      ldClient = init({ sdkKey, featureStoreProvider: mockFeatureStore });
      await ldClient.waitForInitialization();
    });

    afterAll(() => {
      ldClient.close();
    });

    describe('flags', () => {
      it('variation default', async () => {
        const value = await ldClient.variation(flagKey1, context, false);
        expect(value).toBeTruthy();
      });

      it('variation default rollout', async () => {
        const contextWithEmail = { ...context, email: 'test@yahoo.com' };
        const value = await ldClient.variation(flagKey2, contextWithEmail, false);
        const detail = await ldClient.variationDetail(flagKey2, contextWithEmail, false);

        expect(detail).toEqual({ reason: { kind: 'FALLTHROUGH' }, value: true, variationIndex: 0 });
        expect(value).toBeTruthy();
      });

      it('rule match', async () => {
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

      it('fallthrough', async () => {
        const contextWithEmail = { ...context, email: 'test@yahoo.com' };
        const value = await ldClient.variation(flagKey1, contextWithEmail, false);
        const detail = await ldClient.variationDetail(flagKey1, contextWithEmail, false);

        expect(detail).toEqual({ reason: { kind: 'FALLTHROUGH' }, value: true, variationIndex: 0 });
        expect(value).toBeTruthy();
      });

      it('allFlags fallthrough', async () => {
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

    describe('segments', () => {
      it('segment by country', async () => {
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
});
