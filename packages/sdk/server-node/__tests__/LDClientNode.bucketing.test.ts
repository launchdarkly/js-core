/**
 * The common SDK has a number of bucketing tests, but it doesn't have a real hashing algorithm.
 * These tests exercise the hashing from the node platform.
 */
import { integrations } from '@launchdarkly/js-server-sdk-common';
import { TestData } from '@launchdarkly/js-server-sdk-common/dist/integrations';

import { LDClient } from '../src';
import LDClientNode from '../src/LDClientNode';

const seed = 61;
const flagKey = 'flagkey';
const salt = 'salt';
const rollout = {
  kind: 'experiment',
  seed,
  variations: [
    { variation: 0, weight: 10000 },
    { variation: 1, weight: 20000 },
    { variation: 0, weight: 70000, untracked: true },
  ],
};
const flag = {
  key: flagKey,
  salt,
  on: true,
  fallthrough: { rollout },
  variations: [null, null, null],
};

describe('given a client with test data', () => {
  let td: TestData;
  let client: LDClient;

  beforeEach(() => {
    td = new integrations.TestData();
    td.usePreconfiguredFlag(flag);
    client = new LDClientNode('sdk-key', {
      sendEvents: false,
      updateProcessor: td.getFactory(),
    });
  });

  afterEach(() => {
    client.close();
  });

  it('buckets user into first variant of the experiment', async () => {
    const user = { key: 'userKeyA' };
    // const [err, detail, events] = await asyncEvaluate(Evaluator(), flag, user, eventFactory);
    const detail = await client.variationDetail(flagKey, user, null);
    expect(detail.reason).toEqual({ inExperiment: true, kind: 'FALLTHROUGH' });
    expect(detail.variationIndex).toEqual(0);
    expect(detail.reason.inExperiment).toBe(true);
  });

  it('uses seed to bucket user into second variant of the experiment', async () => {
    const user = { key: 'userKeyB' };
    const detail = await client.variationDetail(flagKey, user, null);
    expect(detail.reason).toEqual({ inExperiment: true, kind: 'FALLTHROUGH' });
    expect(detail.variationIndex).toEqual(1);
    expect(detail.reason.inExperiment).toBe(true);
  });

  it('buckets user outside of the experiment', async () => {
    const user = { key: 'userKeyC' };
    const detail = await client.variationDetail(flagKey, user, null);
    expect(detail.reason).toEqual({ kind: 'FALLTHROUGH' });
    expect(detail.variationIndex).toEqual(0);
    expect(detail.reason.inExperiment).toBe(undefined);
  });

  it('does not use bucketBy for experiments', async () => {
    const user = { key: 'userKeyA', kind: 'user', mimic: 'userKeyC' };
    const bucketByFlag = JSON.parse(JSON.stringify(flag));
    bucketByFlag.fallthrough.rollout.bucketBy = 'mimic';
    const detail = await client.variationDetail(flagKey, user, null);
    expect(detail.reason).toEqual({ inExperiment: true, kind: 'FALLTHROUGH' });
    expect(detail.variationIndex).toEqual(0);
    expect(detail.reason.inExperiment).toBe(true);
  });
});
