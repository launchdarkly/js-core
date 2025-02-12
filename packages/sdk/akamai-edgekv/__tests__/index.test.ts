import EdgeKVProvider from '../src/edgekv/edgeKVProvider';
import { init as initWithEdgeKV, LDClient, LDContext, LDLogger } from '../src/index';
import * as testData from './testData.json';

jest.mock('../src/edgekv/edgekv', () => ({
  EdgeKV: jest.fn(),
}));

let logger: LDLogger;

const sdkKey = 'test-sdk-key';
const flagKey1 = 'testFlag1';
const flagKey2 = 'testFlag2';
const flagKey3 = 'testFlag3';
const context: LDContext = { kind: 'user', key: 'test-user-key-1' };

describe('init', () => {
  let ldClient: LDClient;

  describe('init with Edge KV', () => {
    beforeAll(async () => {
      ldClient = initWithEdgeKV({
        namespace: 'akamai-test',
        group: 'Akamai',
        sdkKey,
        options: { logger },
      });
      await ldClient.waitForInitialization();
    });

    beforeEach(() => {
      logger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };
      jest
        .spyOn(EdgeKVProvider.prototype, 'get')
        .mockImplementation(() => Promise.resolve(JSON.stringify(testData)));
    });

    afterAll(() => {
      ldClient.close();
    });

    it('should not log a warning about initialization', async () => {
      const spy = jest.spyOn(logger, 'warn');
      await ldClient.variation(flagKey1, context, false);
      expect(spy).not.toHaveBeenCalled();
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
