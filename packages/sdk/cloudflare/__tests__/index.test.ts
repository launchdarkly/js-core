import type { KVNamespace } from '@cloudflare/workers-types';
import { Miniflare } from 'miniflare';

import { LDClient, LDContext } from '@launchdarkly/js-server-sdk-common-edge';

import { init } from '../src/index';
import * as allFlagsSegments from './testData.json';

const mf = new Miniflare({
  modules: true,
  script: '',
  kvNamespaces: ['TEST_NAMESPACE'],
});

const clientSideID = 'test-client-side-id';
const flagKey1 = 'testFlag1';
const flagKey2 = 'testFlag2';
const flagKey3 = 'testFlag3';
const context: LDContext = { kind: 'user', key: 'test-user-key-1' };
const namespace = 'LD_KV';
const rootEnvKey = `LD-Env-${clientSideID}`;

describe('init', () => {
  describe('without caching', () => {
    let kv: KVNamespace;
    let ldClient: LDClient;

    beforeAll(async () => {
      kv = (await mf.getKVNamespace(namespace)) as unknown as KVNamespace;
      await kv.put(rootEnvKey, JSON.stringify(allFlagsSegments));
      ldClient = init(clientSideID, kv);
      await ldClient.waitForInitialization();
    });

    afterAll(() => {
      ldClient.close();
    });

    describe('flags', () => {
      test('variation default', async () => {
        const value = await ldClient.variation(flagKey1, context, false);
        expect(value).toBeTruthy();
      });

      test('variation default rollout', async () => {
        const contextWithEmail = { ...context, email: 'test@yahoo.com' };
        const value = await ldClient.variation(flagKey2, contextWithEmail, false);
        const detail = await ldClient.variationDetail(flagKey2, contextWithEmail, false);

        expect(detail).toEqual({ reason: { kind: 'FALLTHROUGH' }, value: true, variationIndex: 0 });
        expect(value).toBeTruthy();
      });

      test('rule match', async () => {
        const contextWithEmail = { ...context, email: 'test@falsemail.com' };
        const value = await ldClient.variation(flagKey1, contextWithEmail, false);
        const detail = await ldClient.variationDetail(flagKey1, contextWithEmail, false);

        expect(detail).toEqual({
          reason: { kind: 'RULE_MATCH', ruleId: 'rule1', ruleIndex: 0 },
          value: false,
          variationIndex: 1,
        });
        expect(value).toBeFalsy();
      });

      test('fallthrough', async () => {
        const contextWithEmail = { ...context, email: 'test@yahoo.com' };
        const value = await ldClient.variation(flagKey1, contextWithEmail, false);
        const detail = await ldClient.variationDetail(flagKey1, contextWithEmail, false);

        expect(detail).toEqual({ reason: { kind: 'FALLTHROUGH' }, value: true, variationIndex: 0 });
        expect(value).toBeTruthy();
      });

      test('allFlags fallthrough', async () => {
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
      test('segment by country', async () => {
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

  describe('with caching', () => {
    test('will cache across multiple variation calls', async () => {
      const kv = (await mf.getKVNamespace(namespace)) as unknown as KVNamespace;
      await kv.put(rootEnvKey, JSON.stringify(allFlagsSegments));
      const ldClient = init(clientSideID, kv, { cache: { ttl: 60, checkInterval: 600 } });

      await ldClient.waitForInitialization();
      const spy = jest.spyOn(kv, 'get');
      await ldClient.variation(flagKey1, context, false);
      await ldClient.variation(flagKey2, context, false);
      ldClient.close();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('will cache across multiple allFlags calls', async () => {
      const kv = (await mf.getKVNamespace(namespace)) as unknown as KVNamespace;
      await kv.put(rootEnvKey, JSON.stringify(allFlagsSegments));
      const ldClient = init(clientSideID, kv, { cache: { ttl: 60, checkInterval: 600 } });

      await ldClient.waitForInitialization();
      const spy = jest.spyOn(kv, 'get');
      await ldClient.allFlagsState(context);
      await ldClient.allFlagsState(context);
      ldClient.close();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('will cache between allFlags and variation', async () => {
      const kv = (await mf.getKVNamespace(namespace)) as unknown as KVNamespace;
      await kv.put(rootEnvKey, JSON.stringify(allFlagsSegments));
      const ldClient = init(clientSideID, kv, { cache: { ttl: 60, checkInterval: 600 } });

      await ldClient.waitForInitialization();
      const spy = jest.spyOn(kv, 'get');
      await ldClient.variation(flagKey1, context, false);
      await ldClient.allFlagsState(context);
      ldClient.close();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('will eventually expire', async () => {
      jest.spyOn(Date, 'now').mockImplementation(() => 0);

      const kv = (await mf.getKVNamespace(namespace)) as unknown as KVNamespace;
      await kv.put(rootEnvKey, JSON.stringify(allFlagsSegments));
      const ldClient = init(clientSideID, kv, { cache: { ttl: 60, checkInterval: 600 } });

      await ldClient.waitForInitialization();
      const spy = jest.spyOn(kv, 'get');
      await ldClient.variation(flagKey1, context, false);
      await ldClient.variation(flagKey2, context, false);

      expect(spy).toHaveBeenCalledTimes(1);

      jest.spyOn(Date, 'now').mockImplementation(() => 60 * 1000 + 1);

      await ldClient.variation(flagKey2, context, false);
      expect(spy).toHaveBeenCalledTimes(2);

      ldClient.close();
    });
  });
});
