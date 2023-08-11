import { Context, LDContext } from '@launchdarkly/js-sdk-common';

import { deserializePoll } from '../../src';
import { Flag } from '../../src/evaluation/data/Flag';
import { Segment } from '../../src/evaluation/data/Segment';
import EvalResult from '../../src/evaluation/EvalResult';
import Evaluator from '../../src/evaluation/Evaluator';
import Reasons from '../../src/evaluation/Reasons';
import noQueries from './mocks/noQueries';
import basicPlatform from './mocks/platform';

const offBaseFlag = {
  key: 'feature0',
  version: 1,
  on: false,
  fallthrough: { variation: 1 },
  variations: ['zero', 'one', 'two'],
};

const testData = {
  data: {
    flags: {
      'flag-using-segment': {
        key: 'flag-using-segment',
        on: true,
        prerequisites: [],
        targets: [],
        contextTargets: [],
        rules: [
          {
            variation: 0,
            id: 'ruleid',
            clauses: [
              {
                attribute: '',
                op: 'segmentMatch',
                values: ['segment-requiring-either-of-two-segments'],
                negate: false,
              },
            ],
            trackEvents: false,
          },
        ],
        fallthrough: { variation: 1 },
        offVariation: 1,
        variations: [true, false],
        clientSide: false,
        salt: '',
        trackEvents: false,
        trackEventsFallthrough: false,
        debugEventsUntilDate: null,
        version: 1,
        deleted: false,
      },
    },
    segments: {
      'recursive-segment-1': {
        key: 'recursive-segment-1',
        included: [],
        excluded: [],
        includedContexts: [],
        excludedContexts: [],
        salt: '',
        rules: [
          {
            id: '',
            clauses: [
              {
                attribute: '',
                op: 'segmentMatch',
                values: ['\u003cRECURSIVE_SEGMENT_1_USES\u003e'],
                negate: false,
              },
            ],
          },
        ],
        version: 1,
        generation: null,
        deleted: false,
      },
      'recursive-segment-2': {
        key: 'recursive-segment-2',
        included: [],
        excluded: [],
        includedContexts: [],
        excludedContexts: [],
        salt: '',
        rules: [
          {
            id: '',
            clauses: [
              {
                attribute: '',
                op: 'segmentMatch',
                values: ['\u003cRECURSIVE_SEGMENT_2_USES\u003e'],
                negate: false,
              },
            ],
          },
        ],
        version: 1,
        generation: null,
        deleted: false,
      },
      'recursive-segment-3': {
        key: 'recursive-segment-3',
        included: [],
        excluded: [],
        includedContexts: [],
        excludedContexts: [],
        salt: '',
        rules: [
          {
            id: '',
            clauses: [
              {
                attribute: '',
                op: 'segmentMatch',
                values: ['\u003cRECURSIVE_SEGMENT_3_USES\u003e'],
                negate: false,
              },
            ],
          },
        ],
        version: 1,
        generation: null,
        deleted: false,
      },
      'segment-requiring-both-of-two-segments': {
        key: 'segment-requiring-both-of-two-segments',
        included: [],
        excluded: [],
        includedContexts: [],
        excludedContexts: [],
        salt: '',
        rules: [
          {
            id: '',
            clauses: [
              { attribute: '', op: 'segmentMatch', values: ['segment-with-rule-a'], negate: false },
              { attribute: '', op: 'segmentMatch', values: ['segment-with-rule-b'], negate: false },
            ],
          },
        ],
        version: 1,
        generation: null,
        deleted: false,
      },
      'segment-requiring-either-of-two-segments': {
        key: 'segment-requiring-either-of-two-segments',
        included: [],
        excluded: [],
        includedContexts: [],
        excludedContexts: [],
        salt: '',
        rules: [
          {
            id: '',
            clauses: [
              { attribute: '', op: 'segmentMatch', values: ['segment-with-rule-a'], negate: false },
            ],
          },
          { id: '', clauses: [] },
        ],
        version: 1,
        generation: null,
        deleted: false,
      },
      'segment-that-always-matches': {
        key: 'segment-that-always-matches',
        included: [],
        excluded: [],
        includedContexts: [],
        excludedContexts: [],
        salt: '',
        rules: [{ id: '', clauses: [{ attribute: 'key', op: 'in', values: [''], negate: true }] }],
        version: 1,
        generation: null,
        deleted: false,
      },
      'segment-with-rule-a': {
        key: 'segment-with-rule-a',
        included: [],
        excluded: [],
        includedContexts: [],
        excludedContexts: [],
        salt: '',
        rules: [
          {
            id: '',
            clauses: [
              {
                attribute: 'segment-with-rule-a-should-match',
                op: 'in',
                values: [true],
                negate: false,
              },
            ],
          },
        ],
        version: 1,
        generation: null,
        deleted: false,
      },
      'segment-with-rule-b': {
        key: 'segment-with-rule-b',
        included: [],
        excluded: [],
        includedContexts: [],
        excludedContexts: [],
        salt: '',
        rules: [
          {
            id: '',
            clauses: [
              {
                attribute: 'segment-with-rule-b-should-match',
                op: 'in',
                values: [true],
                negate: false,
              },
            ],
          },
        ],
        version: 1,
        generation: null,
        deleted: false,
      },
    },
  },
};
// DEBUG[2023 -08 - 10 18:01: 22.002] Sending command: { "command": "evaluateAll", "evaluate": null, "evaluateAll": { "context": { "kind": "user", "key": "user-key", "segment-with-rule-a-should-match": false, "segment-with-rule-b-should-match": true }, "withReasons": false, "clientSideOnly": false, "detailsOnlyForTrackedFlags": false }, "customEvent": null, "identifyEvent": null, "contextBuild": null, "contextConvert": null, "secureModeHash": null };

it('evaluates this stupid data', async () => {
  const evalData = deserializePoll(JSON.stringify(testData));
  const evaluator = new Evaluator(basicPlatform, {
    getFlag(key, cb) {
      cb(evalData!.flags[key] as Flag);
    },
    getSegment(key, cb) {
      cb(evalData!.segments[key] as Segment);
    },
    async getBigSegmentsMembership() {
      return undefined;
    },
  });

  const result = await evaluator.evaluate(
    evalData!.flags['flag-using-segment'],
    Context.fromLDContext({
      kind: 'user',
      key: 'user-key',
      'segment-with-rule-b-should-match': true,
      'segment-with-rule-a-should-match': false,
    }),
  );
  expect(result.detail.value).toBeTruthy();
});

describe.each<[Flag, LDContext, EvalResult | undefined]>([
  [
    {
      ...offBaseFlag,
    },
    { key: 'user-key' },
    EvalResult.forSuccess(null, Reasons.Off, undefined),
  ],
  [
    {
      ...offBaseFlag,
      offVariation: 2,
    },
    { key: 'user-key' },
    EvalResult.forSuccess('two', Reasons.Off, 2),
  ],
])('Given off flags and an evaluator', (flag, context, expected) => {
  const evaluator = new Evaluator(basicPlatform, noQueries);

  it(`produces the expected evaluation result for context: ${context.key} ${
    // @ts-ignore
    context.kind
  } targets: ${flag.targets?.map(
    (t) => `${t.values}, ${t.variation}`,
  )} context targets: ${flag.contextTargets?.map(
    (t) => `${t.contextKind}: ${t.values}, ${t.variation}`,
  )}`, async () => {
    const result = await evaluator.evaluate(flag, Context.fromLDContext(context));
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
  variations: ['zero', 'one', 'two'],
};

describe.each<[Flag, LDContext, EvalResult | undefined]>([
  [
    {
      ...targetBaseFlag,
      targets: [
        {
          values: ['user-key'],
          variation: 0,
        },
      ],
    },
    { key: 'user-key' },
    EvalResult.forSuccess('zero', Reasons.TargetMatch, 0),
  ],
  [
    {
      ...targetBaseFlag,
      targets: [
        {
          values: ['user-key'],
          variation: 0,
        },
        {
          values: ['user-key2'],
          variation: 2,
        },
      ],
    },
    { key: 'user-key2' },
    EvalResult.forSuccess('two', Reasons.TargetMatch, 2),
  ],
  [
    {
      ...targetBaseFlag,
      targets: [
        {
          values: ['user-key'],
          variation: 0,
        },
        {
          values: ['user-key2'],
          variation: 2,
        },
      ],
      contextTargets: [
        {
          values: [],
          variation: 2,
        },
      ],
    },
    { key: 'user-key2' },
    EvalResult.forSuccess('two', Reasons.TargetMatch, 2),
  ],
  [
    {
      ...targetBaseFlag,
      targets: [
        {
          values: ['user-key'],
          variation: 0,
        },
        {
          values: ['user-key2'],
          variation: 2,
        },
      ],
      contextTargets: [
        {
          contextKind: 'org',
          values: ['org-key'],
          variation: 1,
        },
      ],
    },
    { kind: 'org', key: 'org-key' },
    EvalResult.forSuccess('one', Reasons.TargetMatch, 1),
  ],
])('given flag configurations with different targets that match', (flag, context, expected) => {
  const evaluator = new Evaluator(basicPlatform, noQueries);
  it(`produces the expected evaluation result for context: ${context.key} ${
    // @ts-ignore
    context.kind
  } targets: ${flag.targets?.map(
    (t) => `${t.values}, ${t.variation}`,
  )} context targets: ${flag.contextTargets?.map(
    (t) => `${t.contextKind}: ${t.values}, ${t.variation}`,
  )}`, async () => {
    const result = await evaluator.evaluate(flag, Context.fromLDContext(context));
    expect(result?.isError).toEqual(expected?.isError);
    expect(result?.detail).toStrictEqual(expected?.detail);
    expect(result?.message).toEqual(expected?.message);
  });
});
