import type { KVNamespace } from '@cloudflare/workers-types';
import { Miniflare } from 'miniflare';
import { init, LDClient } from './index';
import * as allFlagsSegments from './utils/testData.json';

const mf = new Miniflare({
  modules: true,
  script: '',
  kvNamespaces: ['TEST_NAMESPACE'],
});

const sdkKey = 'test-sdk-key';
const flagKey = 'testFlag1';
const context = { kind: 'user', key: 'test-user-key-1' };
const namespace = 'LD_KV';
const rootEnvKey = `LD-Env-${sdkKey}`;

describe('worker', () => {
  let kv: KVNamespace;
  let ldClient: LDClient;

  beforeAll(async () => {
    kv = (await mf.getKVNamespace(namespace)) as unknown as KVNamespace;
    await kv.put(rootEnvKey, JSON.stringify(allFlagsSegments));
    ldClient = init(kv, sdkKey);
    await ldClient.waitForInitialization();
  });

  test('variation', async () => {
    const flagDetail = await ldClient.variation(flagKey, context, false);
    expect(flagDetail).toBeTruthy();
  });

  test('variationDetail', async () => {
    const flagDetail = await ldClient.variationDetail(flagKey, context, false);
    expect(flagDetail).toEqual({ reason: { kind: 'FALLTHROUGH' }, value: true, variationIndex: 0 });
  });

  test('allFlags', async () => {
    const allFlags = await ldClient.allFlagsState(context);

    expect(allFlags).toBeDefined();
    expect(allFlags.toJSON()).toEqual({
      $flagsState: {
        testFlag1: { debugEventsUntilDate: null, variation: 0, version: 2 },
        testFlag2: { debugEventsUntilDate: null, variation: 1, version: 2 },
      },
      $valid: true,
      testFlag1: true,
      testFlag2: false,
    });
  });
});
