import { Context, LDContext } from '@launchdarkly/js-sdk-common';
import { Flag } from '../../src/evaluation/data/Flag';
import EvalResult from '../../src/evaluation/EvalResult';
import evalTargets from '../../src/evaluation/evalTargets';
import Reasons from '../../src/evaluation/Reasons';

const baseFlag = {
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
    ...baseFlag,
    targets: [{
      values: ['user-key'],
      variation: 0,
    }],
  }, { key: 'user-key' }, EvalResult.forSuccess('zero', Reasons.TargetMatch, 0)],
  [{
    ...baseFlag,
    targets: [{
      values: ['user-key'],
      variation: 0,
    }],
  }, { key: 'different-key' }, undefined],
  [{
    ...baseFlag,
    targets: [{
      values: ['user-key'],
      variation: 0,
    },
    {
      values: ['user-key2'],
      variation: 2,
    },
    ],
  }, { key: 'user-key2' }, EvalResult.forSuccess('two', Reasons.TargetMatch, 2)],
  [{
    ...baseFlag,
    targets: [{
      values: ['user-key'],
      variation: 0,
    }],
  }, { key: 'different-key' }, undefined],
  [{
    ...baseFlag,
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
  }, { key: 'user-key2' }, EvalResult.forSuccess('two', Reasons.TargetMatch, 2)],
  [{
    ...baseFlag,
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
  }, { kind: 'org', key: 'user-key2' }, undefined],
  [{
    ...baseFlag,
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
  }, { kind: 'org', key: 'org-key' }, EvalResult.forSuccess('one', Reasons.TargetMatch, 1)],
  [{
    ...baseFlag,
    contextTargets: [{
      values: ['org-key'],
      variation: 1,
    }],
  }, { key: 'user-key' }, undefined],
  [{
    ...baseFlag,
  }, { key: 'user-key' }, undefined],
])('given flag configurations with different targets', (flag, context, expected) => {
  // @ts-ignore
  it(`produces the expected evaluation result for context: ${context.key} ${context.kind} targets: ${flag.targets?.map((t) => `${t.values}, ${t.variation}`)} context targets: ${flag.contextTargets?.map((t) => `${t.contextKind}: ${t.values}, ${t.variation}`)}`, () => {
    const result = evalTargets(flag, Context.fromLDContext(context));
    expect(result?.isError).toEqual(expected?.isError);
    expect(result?.detail).toStrictEqual(expected?.detail);
    expect(result?.message).toEqual(expected?.message);
  });
});
