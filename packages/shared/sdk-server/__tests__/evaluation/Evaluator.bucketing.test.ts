import { Context } from '@launchdarkly/js-sdk-common';

import { Flag } from '../../src/evaluation/data/Flag';
import { Rollout } from '../../src/evaluation/data/Rollout';
import Evaluator from '../../src/evaluation/Evaluator';
import { createBasicPlatform } from '../createBasicPlatform';
import noQueries from './mocks/noQueries';

describe('given a flag with a rollout', () => {
  let evaluator: Evaluator;

  beforeEach(() => {
    evaluator = new Evaluator(createBasicPlatform(), noQueries);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const seed = 61;
  const flagKey = 'flagkey';
  const salt = 'salt';
  const rollout: Rollout = {
    kind: 'experiment',
    seed,
    variations: [
      { variation: 0, weight: 10000 },
      { variation: 1, weight: 20000 },
      { variation: 0, weight: 70000, untracked: true },
    ],
  };
  const flag: Flag = {
    key: flagKey,
    salt,
    on: true,
    fallthrough: { rollout },
    variations: [null, null, null],
    version: 0,
  };

  it('buckets user into first variant of the experiment', async () => {
    const user = { key: 'userKeyA' };
    const res = await evaluator.evaluate(flag, Context.fromLDContext(user));
    expect(res.isError).toBeFalsy();
    expect(res.detail.variationIndex).toEqual(0);
    expect(res.detail.reason.inExperiment).toBe(true);
  });

  it('inExperiment is not set when the context kind is not present', async () => {
    const user = { kind: 'org', key: 'userKeyA' };
    const res = await evaluator.evaluate(flag, Context.fromLDContext(user));
    expect(res.isError).toBeFalsy();
    expect(res.detail.variationIndex).toEqual(0);
    expect(res.detail.reason.inExperiment).toBeUndefined();
  });

  it('does not use bucketBy for experiments', async () => {
    const user = { key: 'userKeyA', kind: 'user', mimic: 'userKeyC' };
    const bucketByFlag = JSON.parse(JSON.stringify(flag));
    bucketByFlag.fallthrough.rollout.bucketBy = 'mimic';
    const res = await evaluator.evaluate(flag, Context.fromLDContext(user));
    expect(res.isError).toBeFalsy();
    expect(res.detail.variationIndex).toEqual(0);
    expect(res.detail.reason.inExperiment).toBe(true);
  });
});
