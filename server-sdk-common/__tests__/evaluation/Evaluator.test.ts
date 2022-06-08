import { Context, LDContext } from '@launchdarkly/js-sdk-common';
import { Flag } from '../../src/evaluation/data/Flag';
import EvalResult from '../../src/evaluation/EvalResult';
import Evaluator from '../../src/evaluation/Evaluator';
import Reasons from '../../src/evaluation/Reasons';
import basicPlatform from './mocks/platform';
import noQueries from './mocks/noQueries';

const offBaseFlag = {
  key: 'feature0',
  version: 1,
  on: false,
  fallthrough: { variation: 1 },
  variations: [
    'zero',
    'one',
    'two',
  ],
};

describe.each<[Flag, LDContext, EvalResult | undefined]>([
  [{
    ...offBaseFlag,
  }, { key: 'user-key' }, EvalResult.ForSuccess(null, Reasons.Off, undefined)],
  [{
    ...offBaseFlag, offVariation: 2,
  }, { key: 'user-key' }, EvalResult.ForSuccess('two', Reasons.Off, 2)],
])('Given off flags and an evaluator', (flag, context, expected) => {
  const evaluator = new Evaluator(basicPlatform, noQueries);

  // @ts-ignore
  it(`produces the expected evaluation result for context: ${context.key} ${context.kind} targets: ${flag.targets?.map((t) => `${t.values}, ${t.variation}`)} context targets: ${flag.contextTargets?.map((t) => `${t.contextKind}: ${t.values}, ${t.variation}`)}`, async () => {
    const result = await evaluator.evaluate(flag, Context.FromLDContext(context)!);
    expect(result?.isError).toEqual(expected?.isError);
    expect(result?.detail).toStrictEqual(expected?.detail);
    expect(result?.message).toEqual(expected?.message);
  });
});

const targetBaseFlag = {
  key: 'feature0',
  version: 1,
  on: true,
  fallthrough: { variation: 1 },
  variations: [
    'zero',
    'one',
    'two',
  ],
};

describe.each<[Flag, LDContext, EvalResult | undefined]>([
  [{
    ...targetBaseFlag,
    targets: [{
      values: ['user-key'],
      variation: 0,
    }],
  }, { key: 'user-key' }, EvalResult.ForSuccess('zero', Reasons.TargetMatch, 0)],
  [{
    ...targetBaseFlag,
    targets: [{
      values: ['user-key'],
      variation: 0,
    },
    {
      values: ['user-key2'],
      variation: 2,
    },
    ],
  }, { key: 'user-key2' }, EvalResult.ForSuccess('two', Reasons.TargetMatch, 2)],
  [{
    ...targetBaseFlag,
    targets: [{
      values: ['user-key'],
      variation: 0,
    },
    {
      values: ['user-key2'],
      variation: 2,
    },
    ],
    contextTargets: [{
      values: [],
      variation: 2,
    }],
  }, { key: 'user-key2' }, EvalResult.ForSuccess('two', Reasons.TargetMatch, 2)],
  [{
    ...targetBaseFlag,
    targets: [{
      values: ['user-key'],
      variation: 0,
    },
    {
      values: ['user-key2'],
      variation: 2,
    },
    ],
    contextTargets: [{
      contextKind: 'org',
      values: ['org-key'],
      variation: 1,
    }],
  }, { kind: 'org', key: 'org-key' }, EvalResult.ForSuccess('one', Reasons.TargetMatch, 1)],
])('given flag configurations with different targets that match', (flag, context, expected) => {
  const evaluator = new Evaluator(basicPlatform, noQueries);
  // @ts-ignore
  it(`produces the expected evaluation result for context: ${context.key} ${context.kind} targets: ${flag.targets?.map((t) => `${t.values}, ${t.variation}`)} context targets: ${flag.contextTargets?.map((t) => `${t.contextKind}: ${t.values}, ${t.variation}`)}`, async () => {
    const result = await evaluator.evaluate(flag, Context.FromLDContext(context)!);
    expect(result?.isError).toEqual(expected?.isError);
    expect(result?.detail).toStrictEqual(expected?.detail);
    expect(result?.message).toEqual(expected?.message);
  });
});
