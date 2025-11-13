import { LDClient, LDContext } from '@launchdarkly/js-server-sdk-common';

import { init, OxygenLDOptions } from '../src/index';
import { setupTestEnvironment } from './setup';

const sdkKey = 'test-sdk-key';
const flagKey1 = 'testFlag1';
const flagKey2 = 'testFlag2';
const flagKey3 = 'testFlag3';
const context: LDContext = { kind: 'user', key: 'test-user-key-1' };

describe('Shopify Oxygen SDK', () => {
  describe('initialization tests', () => {
    beforeEach(async () => {
      await setupTestEnvironment();
    });

    it('will initialize successfully with default options', async () => {
      const ldClient = init(sdkKey);
      await ldClient.waitForInitialization();
      expect(ldClient).toBeDefined();
      ldClient.close();
    });

    it('will initialize successfully with custom options', async () => {
      const ldClient = init(sdkKey, {
        sendEvents: false,
        cache: {
          enabled: false,
        },
      } as OxygenLDOptions);
      await ldClient.waitForInitialization();
      expect(ldClient).toBeDefined();
      ldClient.close();
    });

    it('will fail to initialize if there is no SDK key', () => {
      expect(() => init(null as any)).toThrow();
    });
  });

  describe('polling tests', () => {
    beforeEach(async () => {
      await setupTestEnvironment();
    });

    describe('without caching', () => {
      let ldClient: LDClient;

      beforeEach(async () => {
        // Ensure fetch is set up before creating client
        ldClient = init(sdkKey, {
          cache: {
            enabled: false,
          },
        } as OxygenLDOptions);
        await ldClient.waitForInitialization();
      });

      afterEach(() => {
        if (ldClient) {
          ldClient.close();
        }
      });

      it('Should not cache any requests', async () => {
        await ldClient.variation(flagKey1, context, false);
        await ldClient.allFlagsState(context);
        await ldClient.variationDetail(flagKey3, context, false);
        expect(caches.open).toHaveBeenCalledTimes(0);
      });

      describe('flags', () => {
        it('variation default', async () => {
          const value = await ldClient.variation(flagKey1, context, false);

          expect(value).toBeTruthy();

          expect(caches.open).toHaveBeenCalledTimes(0);
        });

        it('variation default rollout', async () => {
          const contextWithEmail = { ...context, email: 'test@yahoo.com' };
          const value = await ldClient.variation(flagKey2, contextWithEmail, false);
          const detail = await ldClient.variationDetail(flagKey2, contextWithEmail, false);

          expect(detail).toEqual({
            reason: { kind: 'FALLTHROUGH' },
            value: true,
            variationIndex: 0,
          });
          expect(value).toBeTruthy();

          expect(caches.open).toHaveBeenCalledTimes(0);
        });

        it('rule match', async () => {
          const contextWithEmail = { ...context, email: 'test@falsemail.com' };
          const value = await ldClient.variation(flagKey1, contextWithEmail, false);
          const detail = await ldClient.variationDetail(flagKey1, contextWithEmail, false);

          expect(detail).toEqual({
            reason: { kind: 'RULE_MATCH', ruleId: 'rule1', ruleIndex: 0 },
            value: false,
            variationIndex: 1,
          });
          expect(value).toBeFalsy();

          expect(caches.open).toHaveBeenCalledTimes(0);
        });

        it('fallthrough', async () => {
          const contextWithEmail = { ...context, email: 'test@yahoo.com' };
          const value = await ldClient.variation(flagKey1, contextWithEmail, false);
          const detail = await ldClient.variationDetail(flagKey1, contextWithEmail, false);

          expect(detail).toEqual({
            reason: { kind: 'FALLTHROUGH' },
            value: true,
            variationIndex: 0,
          });
          expect(value).toBeTruthy();

          expect(caches.open).toHaveBeenCalledTimes(0);
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

          expect(caches.open).toHaveBeenCalledTimes(0);
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

          expect(caches.open).toHaveBeenCalledTimes(0);
        });
      });
    });

    describe('with caching', () => {
      let ldClient: LDClient;

      beforeEach(async () => {
        // Ensure fetch is set up before creating client
        ldClient = init(sdkKey);
        await ldClient.waitForInitialization();
      });

      afterEach(() => {
        if (ldClient) {
          ldClient.close();
        }
      });

      it('will cache across multiple variation calls', async () => {
        await ldClient.variation(flagKey1, context, false);
        await ldClient.variation(flagKey2, context, false);

        // Should only fetch once due to caching
        expect(caches.open).toHaveBeenCalledTimes(1);
      });

      it('will cache across multiple allFlags calls', async () => {
        await ldClient.allFlagsState(context);
        await ldClient.allFlagsState(context);

        expect(caches.open).toHaveBeenCalledTimes(1);
      });

      it('will cache between allFlags and variation', async () => {
        await ldClient.variation(flagKey1, context, false);
        await ldClient.allFlagsState(context);

        expect(caches.open).toHaveBeenCalledTimes(1);
      });
    });
  });
});
