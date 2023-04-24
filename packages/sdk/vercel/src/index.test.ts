import type { EdgeConfigValue } from '@vercel/edge-config';
import { LDClient } from '@launchdarkly/js-server-sdk-common-edge';
import { init } from './index';
import * as testData from './utils/testData.json';
import mockEdge from './utils/mockEdge';

const sdkKey = 'test-sdk-key';
const flagKey = 'testFlag1';
const context = { kind: 'user', key: 'test-user-key-1' };

describe('init', () => {
  let ldClient: LDClient;

  beforeAll(async () => {
    // I can't figure out a way around the generic types used in @vercel/edge-config causing us type issues here.
    // The tests work as expected
    // @ts-ignore
    mockEdge.get = jest.fn(async () => testData as EdgeConfigValue);
    ldClient = init(sdkKey, mockEdge);
    await ldClient.waitForInitialization();
  });

  afterAll(() => {
    ldClient.close();
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
