/* eslint-disable no-underscore-dangle */
import { Context, internal } from '@launchdarkly/js-sdk-common';

import { BigSegmentStoreMembership } from '../../src/api/interfaces';
import { Flag } from '../../src/evaluation/data/Flag';
import { Segment } from '../../src/evaluation/data/Segment';
import EvalResult from '../../src/evaluation/EvalResult';
import Evaluator from '../../src/evaluation/Evaluator';
import { Queries } from '../../src/evaluation/Queries';
import EventFactory from '../../src/events/EventFactory';
import { deserializePoll, FlagsAndSegments } from '../../src/store/serialization';
import { createBasicPlatform } from '../createBasicPlatform';

const context = Context.fromLDContext({ kind: 'user', key: 'userkey' });
const eventFactory = new EventFactory(true);

/**
 * A flag that is on and serves variation 1 ("on") by fallthrough, with optional prerequisites
 * that must each serve variation 1.
 */
function testFlag(key: string, prereqKeys: string[] = [], extra: Record<string, any> = {}): any {
  return {
    key,
    version: 1,
    on: true,
    fallthrough: { variation: 1 },
    offVariation: 0,
    variations: ['off', 'on'],
    prerequisites: prereqKeys.map((prereqKey) => ({ key: prereqKey, variation: 1 })),
    ...extra,
  };
}

/**
 * A boolean flag whose single rule matches when the context is in any of the segments.
 */
function segmentMatchFlag(key: string, segmentKeys: string[], negate: boolean = false): any {
  return {
    key,
    version: 1,
    on: true,
    fallthrough: { variation: 0 },
    offVariation: 0,
    variations: [false, true],
    rules: [
      {
        id: 'rule-id',
        variation: 1,
        clauses: [{ attribute: '', op: 'segmentMatch', values: segmentKeys, negate }],
      },
    ],
  };
}

function segmentIncluding(key: string, ...userKeys: string[]): any {
  return { key, version: 1, included: userKeys };
}

class TestQueries implements Queries {
  constructor(private readonly _data: FlagsAndSegments) {}

  getFlag(key: string, cb: (flag: Flag | undefined) => void): void {
    cb(this._data.flags[key]);
  }

  getSegment(key: string, cb: (segment: Segment | undefined) => void): void {
    cb(this._data.segments[key]);
  }

  getBigSegmentsMembership(
    _userKey: string,
  ): Promise<[BigSegmentStoreMembership | null, string] | undefined> {
    throw new Error('Method not implemented.');
  }
}

/**
 * Processes the given data the way the SDK does for data from LaunchDarkly, then marks the named
 * entries as override entries. Returns the processed data and an evaluator over it.
 */
function setup(
  flags: Record<string, any>,
  segments: Record<string, any> = {},
  overrides: { flags?: string[]; segments?: string[] } = {},
) {
  const data = deserializePoll(JSON.stringify({ flags, segments }))!;
  overrides.flags?.forEach((key) => {
    data.flags[key]._sdk_override = true;
  });
  overrides.segments?.forEach((key) => {
    data.segments[key]._sdk_override = true;
  });
  const evaluator = new Evaluator(createBasicPlatform(), new TestQueries(data));
  return { data, evaluator };
}

/**
 * Checks the reason indicator and the result scalar together. Both report the same marking. The
 * scalar is what event generation uses, so it must not lag behind the reason.
 */
function expectOverrideAffected(expected: boolean, result: EvalResult) {
  if (expected) {
    expect(result.detail.reason.overrideAffected).toBe(true);
  } else {
    expect(result.detail.reason).not.toHaveProperty('overrideAffected');
  }
  expect(result.overrideAffected).toBe(expected);
}

/**
 * The record of a prerequisite evaluation is the event the evaluator produced for it.
 */
function prereqRecord(result: EvalResult, prereqKey: string): internal.InputEvalEvent {
  const record = result.events?.find((event) => event.key === prereqKey);
  if (!record) {
    throw new Error(`no record for prerequisite ${prereqKey}`);
  }
  return record;
}

function expectRecordOverrideAffected(expected: boolean, record: internal.InputEvalEvent) {
  if (expected) {
    expect(record.reason?.overrideAffected).toBe(true);
  } else {
    expect(record.reason).not.toHaveProperty('overrideAffected');
  }
}

describe('given an override flag', () => {
  it('marks an off evaluation', async () => {
    const { data, evaluator } = setup(
      { feature: testFlag('feature', [], { on: false }) },
      {},
      { flags: ['feature'] },
    );
    const result = await evaluator.evaluate(data.flags.feature, context);

    expect(result.detail.reason.kind).toEqual('OFF');
    expect(result.detail.value).toEqual('off');
    expectOverrideAffected(true, result);
  });

  it('marks a fallthrough evaluation', async () => {
    const { data, evaluator } = setup({ feature: testFlag('feature') }, {}, { flags: ['feature'] });
    const result = await evaluator.evaluate(data.flags.feature, context);

    expect(result.detail.reason.kind).toEqual('FALLTHROUGH');
    expect(result.detail.value).toEqual('on');
    expectOverrideAffected(true, result);
  });

  it('marks a rule match evaluation and keeps the rule fields', async () => {
    const flag = testFlag('feature', [], {
      fallthrough: { variation: 0 },
      rules: [
        {
          id: 'rule-id',
          variation: 1,
          clauses: [{ attribute: 'key', op: 'in', values: ['userkey'] }],
        },
      ],
    });
    const { data, evaluator } = setup({ feature: flag }, {}, { flags: ['feature'] });
    const result = await evaluator.evaluate(data.flags.feature, context);

    expect(result.detail.reason).toEqual({
      kind: 'RULE_MATCH',
      ruleId: 'rule-id',
      ruleIndex: 0,
      overrideAffected: true,
    });
    expect(result.detail.value).toEqual('on');
    expectOverrideAffected(true, result);
  });

  it('marks a malformed flag error result', async () => {
    const { data, evaluator } = setup(
      { feature: testFlag('feature', [], { fallthrough: { variation: 99 } }) },
      {},
      { flags: ['feature'] },
    );
    const result = await evaluator.evaluate(data.flags.feature, context);

    expect(result.isError).toBe(true);
    expect(result.detail.reason.kind).toEqual('ERROR');
    expect(result.detail.reason.errorKind).toEqual('MALFORMED_FLAG');
    expect(result.detail.value).toBeNull();
    expectOverrideAffected(true, result);
  });

  it('does not mark the record of a prerequisite that read no override definition', async () => {
    const { data, evaluator } = setup(
      { feature: testFlag('feature', ['prereq']), prereq: testFlag('prereq') },
      {},
      { flags: ['feature'] },
    );
    const result = await evaluator.evaluate(data.flags.feature, context, eventFactory);

    expectOverrideAffected(true, result);
    expectRecordOverrideAffected(false, prereqRecord(result, 'prereq'));
  });
});

describe('given plain LaunchDarkly data', () => {
  it('does not mark a flag evaluated alone', async () => {
    const { data, evaluator } = setup({ feature: testFlag('feature', [], { on: false }) });
    const result = await evaluator.evaluate(data.flags.feature, context);

    expect(result.detail.reason).toEqual({ kind: 'OFF' });
    expectOverrideAffected(false, result);
  });

  it('does not mark a flag with a prerequisite and a segment', async () => {
    const { data, evaluator } = setup(
      { feature: testFlag('feature', ['prereq']), prereq: segmentMatchFlag('prereq', ['segment']) },
      { segment: segmentIncluding('segment', 'userkey') },
    );
    const result = await evaluator.evaluate(data.flags.feature, context, eventFactory);

    expect(result.detail.reason.kind).toEqual('FALLTHROUGH');
    expect(result.detail.value).toEqual('on');
    expectOverrideAffected(false, result);
    expectRecordOverrideAffected(false, prereqRecord(result, 'prereq'));
  });
});

describe('given an override prerequisite', () => {
  it('marks the prerequisite record and the top level', async () => {
    const { data, evaluator } = setup(
      { feature: testFlag('feature', ['prereq']), prereq: testFlag('prereq') },
      {},
      { flags: ['prereq'] },
    );
    const result = await evaluator.evaluate(data.flags.feature, context, eventFactory);

    expect(result.detail.reason.kind).toEqual('FALLTHROUGH');
    expectOverrideAffected(true, result);

    const record = prereqRecord(result, 'prereq');
    expect(record.reason?.kind).toEqual('FALLTHROUGH');
    expectRecordOverrideAffected(true, record);
  });

  it('marks all affected scopes for a prerequisite at depth two', async () => {
    const { data, evaluator } = setup(
      {
        feature: testFlag('feature', ['prereq1']),
        prereq1: testFlag('prereq1', ['prereq2']),
        prereq2: testFlag('prereq2'),
      },
      {},
      { flags: ['prereq2'] },
    );
    const result = await evaluator.evaluate(data.flags.feature, context, eventFactory);

    expect(result.detail.reason.kind).toEqual('FALLTHROUGH');
    expectOverrideAffected(true, result);

    // The nested record is produced first, during the evaluation of prereq1.
    expect(result.events?.map((event) => event.key)).toEqual(['prereq2', 'prereq1']);
    expectRecordOverrideAffected(true, prereqRecord(result, 'prereq2'));
    expectRecordOverrideAffected(true, prereqRecord(result, 'prereq1'));
  });

  it('keeps an unaffected sibling prerequisite record unmarked', async () => {
    // Flag a has prerequisites b and c. Only d, a prerequisite of b, is an override. The marking
    // reaches a, b, and d. It does not reach the sibling c, and the plain segments mark nothing.
    const a = testFlag('a', ['b', 'c'], {
      fallthrough: { variation: 0 },
      rules: [
        {
          id: 'rule-s2',
          variation: 1,
          clauses: [{ attribute: '', op: 'segmentMatch', values: ['s2'] }],
        },
      ],
    });
    const { data, evaluator } = setup(
      { a, b: testFlag('b', ['d']), c: segmentMatchFlag('c', ['s1']), d: testFlag('d') },
      { s1: segmentIncluding('s1', 'userkey'), s2: segmentIncluding('s2', 'userkey') },
      { flags: ['d'] },
    );
    const result = await evaluator.evaluate(data.flags.a, context, eventFactory);

    expect(result.detail.reason.kind).toEqual('RULE_MATCH');
    expect(result.detail.value).toEqual('on');
    expectOverrideAffected(true, result);

    expect(result.events).toHaveLength(3);
    expectRecordOverrideAffected(true, prereqRecord(result, 'd'));
    expectRecordOverrideAffected(true, prereqRecord(result, 'b'));
    expectRecordOverrideAffected(false, prereqRecord(result, 'c'));
  });

  it('marks the top level when a prerequisite cycle passes through the override', async () => {
    const { data, evaluator } = setup(
      { feature: testFlag('feature', ['prereq']), prereq: testFlag('prereq', ['feature']) },
      {},
      { flags: ['prereq'] },
    );
    const result = await evaluator.evaluate(data.flags.feature, context, eventFactory);

    expect(result.detail.reason.kind).toEqual('ERROR');
    expect(result.detail.reason.errorKind).toEqual('MALFORMED_FLAG');
    expectOverrideAffected(true, result);
  });
});

describe('given an override segment', () => {
  it('marks an evaluation whose flag rule matches the segment', async () => {
    const { data, evaluator } = setup(
      { feature: segmentMatchFlag('feature', ['segment']) },
      { segment: segmentIncluding('segment', 'userkey') },
      { segments: ['segment'] },
    );
    const result = await evaluator.evaluate(data.flags.feature, context);

    expect(result.detail.reason.kind).toEqual('RULE_MATCH');
    expect(result.detail.value).toBe(true);
    expectOverrideAffected(true, result);
  });

  it('marks an evaluation that reads the segment without matching it', async () => {
    const { data, evaluator } = setup(
      { feature: segmentMatchFlag('feature', ['segment']) },
      { segment: segmentIncluding('segment', 'someone-else') },
      { segments: ['segment'] },
    );
    const result = await evaluator.evaluate(data.flags.feature, context);

    expect(result.detail.reason.kind).toEqual('FALLTHROUGH');
    expect(result.detail.value).toBe(false);
    expectOverrideAffected(true, result);
  });

  it('marks an evaluation whose negated clause matches because the segment does not', async () => {
    const { data, evaluator } = setup(
      { feature: segmentMatchFlag('feature', ['segment'], true) },
      { segment: segmentIncluding('segment', 'someone-else') },
      { segments: ['segment'] },
    );
    const result = await evaluator.evaluate(data.flags.feature, context);

    expect(result.detail.reason.kind).toEqual('RULE_MATCH');
    expect(result.detail.value).toBe(true);
    expectOverrideAffected(true, result);
  });

  it('marks an evaluation that reads the segment through a rule of another segment', async () => {
    const outer = {
      key: 'outer-segment',
      version: 1,
      rules: [{ clauses: [{ attribute: '', op: 'segmentMatch', values: ['nested-segment'] }] }],
    };
    const { data, evaluator } = setup(
      { feature: segmentMatchFlag('feature', ['outer-segment']) },
      { 'outer-segment': outer, 'nested-segment': segmentIncluding('nested-segment', 'userkey') },
      { segments: ['nested-segment'] },
    );
    const result = await evaluator.evaluate(data.flags.feature, context);

    expect(result.detail.reason.kind).toEqual('RULE_MATCH');
    expect(result.detail.value).toBe(true);
    expectOverrideAffected(true, result);
  });

  it('marks the prerequisite record and the top level when a prerequisite reads the segment', async () => {
    const { data, evaluator } = setup(
      { feature: testFlag('feature', ['prereq']), prereq: segmentMatchFlag('prereq', ['segment']) },
      { segment: segmentIncluding('segment', 'userkey') },
      { segments: ['segment'] },
    );
    const result = await evaluator.evaluate(data.flags.feature, context, eventFactory);

    expect(result.detail.reason.kind).toEqual('FALLTHROUGH');
    expectOverrideAffected(true, result);
    expectRecordOverrideAffected(true, prereqRecord(result, 'prereq'));
  });
});

describe('given a definition that cannot be resolved', () => {
  it('does not mark an evaluation with a missing prerequisite', async () => {
    const { data, evaluator } = setup(
      { feature: testFlag('feature', ['missing']), unrelated: testFlag('unrelated') },
      {},
      { flags: ['unrelated'] },
    );
    const result = await evaluator.evaluate(data.flags.feature, context, eventFactory);

    expect(result.detail.reason).toEqual({
      kind: 'PREREQUISITE_FAILED',
      prerequisiteKey: 'missing',
    });
    expect(result.detail.value).toEqual('off');
    expectOverrideAffected(false, result);
    expect(result.events ?? []).toHaveLength(0);
  });

  it('does not mark an evaluation with a missing segment', async () => {
    const { data, evaluator } = setup(
      { feature: segmentMatchFlag('feature', ['missing']) },
      { unrelated: segmentIncluding('unrelated', 'userkey') },
      { segments: ['unrelated'] },
    );
    const result = await evaluator.evaluate(data.flags.feature, context);

    expect(result.detail.reason.kind).toEqual('FALLTHROUGH');
    expect(result.detail.value).toBe(false);
    expectOverrideAffected(false, result);
  });
});

describe.each([
  ['neither', false, false],
  ['flag only', true, false],
  ['prerequisite only', false, true],
  ['both', true, true],
])(
  'given %s of the flag and its prerequisite is an override',
  (_name, flagOverride, prereqOverride) => {
    it('reports the same marking on the result and on the reason', async () => {
      const overrideFlags = [
        ...(flagOverride ? ['feature'] : []),
        ...(prereqOverride ? ['prereq'] : []),
      ];
      const { data, evaluator } = setup(
        { feature: testFlag('feature', ['prereq']), prereq: testFlag('prereq') },
        {},
        { flags: overrideFlags },
      );
      const result = await evaluator.evaluate(data.flags.feature, context, eventFactory);

      expect(!!result.detail.reason.overrideAffected).toEqual(result.overrideAffected);
      expect(result.overrideAffected).toEqual(flagOverride || prereqOverride);

      const record = prereqRecord(result, 'prereq');
      expect(!!record.reason?.overrideAffected).toEqual(prereqOverride);
    });
  },
);
