/* eslint-disable no-underscore-dangle */
// Edge cases of override-affected marking that the main suite does not reach: prerequisites
// that are off, fail, or are never read; segments behind failing clauses, in cycles, and in big
// segment stores; shared reason objects; and evaluations that interleave on asynchronous reads.
import { Context, internal } from '@launchdarkly/js-sdk-common';

import { BigSegmentStoreMembership } from '../../src/api/interfaces';
import { Flag } from '../../src/evaluation/data/Flag';
import { Segment } from '../../src/evaluation/data/Segment';
import EvalResult from '../../src/evaluation/EvalResult';
import Evaluator from '../../src/evaluation/Evaluator';
import makeBigSegmentRef from '../../src/evaluation/makeBigSegmentRef';
import { Queries } from '../../src/evaluation/Queries';
import Reasons from '../../src/evaluation/Reasons';
import EventFactory from '../../src/events/EventFactory';
import { deserializePoll, FlagsAndSegments } from '../../src/store/serialization';
import { createBasicPlatform } from '../createBasicPlatform';

const user = Context.fromLDContext({ kind: 'user', key: 'userkey' });
const withReasons = new EventFactory(true);

function flag(key: string, prereqs: string[] = [], extra: Record<string, any> = {}): any {
  return {
    key,
    version: 1,
    on: true,
    fallthrough: { variation: 1 },
    offVariation: 0,
    variations: ['off', 'on'],
    prerequisites: prereqs.map((k) => ({ key: k, variation: 1 })),
    salt: 'salt',
    ...extra,
  };
}

function segFlag(key: string, segs: string[], extra: Record<string, any> = {}): any {
  return flag(key, [], {
    fallthrough: { variation: 0 },
    rules: [
      {
        id: 'r0',
        variation: 1,
        clauses: [{ attribute: '', op: 'segmentMatch', values: segs }],
      },
    ],
    ...extra,
  });
}

type Deferred = { resolve: () => void; promise: Promise<void> };
function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { resolve, promise };
}

class GatedQueries implements Queries {
  public gates: Record<string, Deferred> = {};

  constructor(
    private readonly _data: FlagsAndSegments,
    private readonly _membership: BigSegmentStoreMembership | null = {},
    private readonly _status: string = 'HEALTHY',
  ) {}

  getFlag(key: string, cb: (f: Flag | undefined) => void): void {
    cb(this._data.flags[key]);
  }

  getSegment(key: string, cb: (s: Segment | undefined) => void): void {
    cb(this._data.segments[key]);
  }

  async getBigSegmentsMembership(
    userKey: string,
  ): Promise<[BigSegmentStoreMembership | null, string] | undefined> {
    const gate = this.gates[userKey];
    if (gate) {
      await gate.promise;
    }
    return [this._membership, this._status];
  }
}

function setup(
  flags: Record<string, any>,
  segments: Record<string, any>,
  marked: { flags?: string[]; segments?: string[] },
  membership: BigSegmentStoreMembership | null = {},
  status = 'HEALTHY',
) {
  const data = deserializePoll(JSON.stringify({ flags, segments }))!;
  marked.flags?.forEach((k) => {
    data.flags[k]._sdk_override = true;
  });
  marked.segments?.forEach((k) => {
    data.segments[k]._sdk_override = true;
  });
  const queries = new GatedQueries(data, membership, status);
  const evaluator = new Evaluator(createBasicPlatform(), queries);
  return { data, queries, evaluator };
}

function marked(res: EvalResult): boolean {
  const onReason = res.detail.reason.overrideAffected;
  // Divergence detector: the scalar and the reason must agree, and false is never emitted.
  expect(onReason === undefined || onReason === true).toBe(true);
  expect(!!onReason).toBe(res.overrideAffected);
  return res.overrideAffected;
}

function rec(res: EvalResult, key: string): internal.InputEvalEvent {
  const r = res.events?.find((e) => e.key === key);
  if (!r) throw new Error(`no record ${key}`);
  return r;
}

function recMarked(r: internal.InputEvalEvent): boolean {
  const v = r.reason?.overrideAffected;
  expect(v === undefined || v === true).toBe(true);
  return !!v;
}

describe('given definitions read during matching', () => {
  it('an off marked prerequisite marks the parent and its own record', async () => {
    const { data, evaluator } = setup(
      { a: flag('a', ['p']), p: flag('p', [], { on: false }) },
      {},
      { flags: ['p'] },
    );
    const res = await evaluator.evaluate(data.flags.a, user, withReasons);
    expect(res.detail.reason.kind).toBe('PREREQUISITE_FAILED');
    expect(marked(res)).toBe(true);
    expect(recMarked(rec(res, 'p'))).toBe(true);
  });

  it('a marked prerequisite with a non-matching variation marks the parent', async () => {
    const { data, evaluator } = setup(
      { a: flag('a', ['p']), p: flag('p', [], { fallthrough: { variation: 0 } }) },
      {},
      { flags: ['p'] },
    );
    const res = await evaluator.evaluate(data.flags.a, user, withReasons);
    expect(res.detail.reason).toMatchObject({ kind: 'PREREQUISITE_FAILED', prerequisiteKey: 'p' });
    expect(marked(res)).toBe(true);
  });

  it('a marked prerequisite after a failing one is not read and does not mark', async () => {
    const { data, evaluator } = setup(
      {
        a: flag('a', ['p1', 'p2']),
        p1: flag('p1', [], { fallthrough: { variation: 0 } }),
        p2: flag('p2'),
      },
      {},
      { flags: ['p2'] },
    );
    const res = await evaluator.evaluate(data.flags.a, user, withReasons);
    expect(res.events?.map((e) => e.key)).toEqual(['p1']);
    expect(marked(res)).toBe(false);
  });

  it('a marked segment after a failing clause is not read and does not mark', async () => {
    const f = flag('a', [], {
      fallthrough: { variation: 0 },
      rules: [
        {
          id: 'r0',
          variation: 1,
          clauses: [
            { attribute: 'key', op: 'in', values: ['nobody'] },
            { attribute: '', op: 'segmentMatch', values: ['s'], negate: true },
          ],
        },
      ],
    });
    const { data, evaluator } = setup(
      { a: f },
      { s: { key: 's', version: 1 } },
      { segments: ['s'] },
    );
    const res = await evaluator.evaluate(data.flags.a, user);
    expect(res.detail.reason.kind).toBe('FALLTHROUGH');
    expect(marked(res)).toBe(false);
  });

  it('a marked segment that is only reached after an earlier matching segment is not read', async () => {
    const { data, evaluator } = setup(
      { a: segFlag('a', ['s1', 's2']) },
      { s1: { key: 's1', version: 1, included: ['userkey'] }, s2: { key: 's2', version: 1 } },
      { segments: ['s2'] },
    );
    const res = await evaluator.evaluate(data.flags.a, user);
    expect(res.detail.reason.kind).toBe('RULE_MATCH');
    expect(marked(res)).toBe(false);
  });

  it.each([
    [
      'includedContexts',
      { includedContexts: [{ contextKind: 'user', values: ['userkey'] }] },
      true,
    ],
    [
      'excludedContexts',
      { excludedContexts: [{ contextKind: 'user', values: ['userkey'] }] },
      false,
    ],
    ['excluded', { excluded: ['userkey'] }, false],
  ])('a marked segment resolved by %s marks', async (_n, segExtra, value) => {
    const { data, evaluator } = setup(
      { a: segFlag('a', ['s'], { variations: [false, true] }) },
      { s: { key: 's', version: 1, ...segExtra } },
      { segments: ['s'] },
    );
    const res = await evaluator.evaluate(data.flags.a, user);
    expect(res.detail.value).toBe(value);
    expect(marked(res)).toBe(true);
  });

  it('a marked segment in a segment cycle marks the error result', async () => {
    const loop = (key: string, next: string) => ({
      key,
      version: 1,
      rules: [{ clauses: [{ attribute: '', op: 'segmentMatch', values: [next] }] }],
    });
    const { data, evaluator } = setup(
      { a: segFlag('a', ['s1']) },
      { s1: loop('s1', 's2'), s2: loop('s2', 's1') },
      { segments: ['s2'] },
    );
    const res = await evaluator.evaluate(data.flags.a, user);
    expect(res.detail.reason).toMatchObject({ kind: 'ERROR', errorKind: 'MALFORMED_FLAG' });
    expect(marked(res)).toBe(true);
  });

  it('a marked big segment with a context kind mismatch marks', async () => {
    const big = {
      key: 'b',
      version: 1,
      unbounded: true,
      unboundedContextKind: 'org',
      generation: 1,
    };
    const { data, evaluator } = setup({ a: segFlag('a', ['b']) }, { b: big }, { segments: ['b'] });
    const res = await evaluator.evaluate(data.flags.a, user);
    expect(res.detail.reason.kind).toBe('FALLTHROUGH');
    expect(marked(res)).toBe(true);
  });

  it('a marked big segment with no generation marks and reports NOT_CONFIGURED', async () => {
    const big = { key: 'b', version: 1, unbounded: true };
    const { data, evaluator } = setup({ a: segFlag('a', ['b']) }, { b: big }, { segments: ['b'] });
    const res = await evaluator.evaluate(data.flags.a, user);
    expect(res.detail.reason).toMatchObject({ bigSegmentsStatus: 'NOT_CONFIGURED' });
    expect(marked(res)).toBe(true);
  });

  it('a marked big segment during a store error marks and reports STORE_ERROR', async () => {
    const big = { key: 'b', version: 1, unbounded: true, generation: 2 };
    const { data, evaluator } = setup(
      { a: segFlag('a', ['b']) },
      { b: big },
      { segments: ['b'] },
      null,
      'STORE_ERROR',
    );
    const res = await evaluator.evaluate(data.flags.a, user);
    expect(res.detail.reason).toMatchObject({
      kind: 'FALLTHROUGH',
      bigSegmentsStatus: 'STORE_ERROR',
      overrideAffected: true,
    });
    expect(marked(res)).toBe(true);
  });

  it('a marked flag served by an experiment fallthrough rollout keeps inExperiment', async () => {
    const f = flag('a', [], {
      fallthrough: {
        rollout: { kind: 'experiment', variations: [{ variation: 1, weight: 100000 }] },
      },
    });
    const { data, evaluator } = setup({ a: f }, {}, { flags: ['a'] });
    const res = await evaluator.evaluate(data.flags.a, user);
    expect(res.detail.reason).toEqual({
      kind: 'FALLTHROUGH',
      inExperiment: true,
      overrideAffected: true,
    });
    expect(marked(res)).toBe(true);
  });

  it('marking target, off, and fallthrough results does not mutate the shared reasons', async () => {
    const { data, evaluator } = setup(
      {
        t: flag('t', [], { targets: [{ variation: 1, values: ['userkey'] }] }),
        o: flag('o', [], { on: false }),
        f: flag('f'),
      },
      {},
      { flags: ['t', 'o', 'f'] },
    );
    const t = await evaluator.evaluate(data.flags.t, user);
    const o = await evaluator.evaluate(data.flags.o, user);
    const f = await evaluator.evaluate(data.flags.f, user);
    expect([t, o, f].map(marked)).toEqual([true, true, true]);
    expect(Reasons.TargetMatch).toEqual({ kind: 'TARGET_MATCH' });
    expect(Reasons.Off).toEqual({ kind: 'OFF' });
    expect(Reasons.Fallthrough).toEqual({ kind: 'FALLTHROUGH' });
  });
});

describe('given prerequisite trees', () => {
  it('a sibling evaluated before the marked prerequisite stays unmarked', async () => {
    const { data, evaluator } = setup(
      { a: flag('a', ['c', 'b']), b: flag('b', ['d']), c: flag('c'), d: flag('d') },
      {},
      { flags: ['d'] },
    );
    const res = await evaluator.evaluate(data.flags.a, user, withReasons);
    expect(res.events?.map((e) => [e.key, recMarked(e)])).toEqual([
      ['c', false],
      ['d', true],
      ['b', true],
    ]);
    expect(marked(res)).toBe(true);
  });

  it('an unmarked erroring prerequisite inside a marked flag keeps an unmarked record', async () => {
    const { data, evaluator } = setup(
      { a: flag('a', ['p']), p: flag('p', [], { fallthrough: { variation: 99 } }) },
      {},
      { flags: ['a'] },
    );
    const res = await evaluator.evaluate(data.flags.a, user, withReasons);
    // The top-level result object is the prerequisite's error result, marked afterward.
    expect(res.detail.reason).toMatchObject({ kind: 'ERROR', overrideAffected: true });
    expect(marked(res)).toBe(true);
    expect(recMarked(rec(res, 'p'))).toBe(false);
  });

  it('a cycle through a marked prerequisite marks only the reads of each record', async () => {
    // a (plain) -> b (marked) -> a (plain, second read) -> b: cycle error.
    const { data, evaluator } = setup(
      { a: flag('a', ['b']), b: flag('b', ['a']) },
      {},
      { flags: ['b'] },
    );
    const res = await evaluator.evaluate(data.flags.a, user, withReasons);
    expect(res.detail.reason.kind).toBe('ERROR');
    expect(marked(res)).toBe(true);
    expect(res.events?.map((e) => [e.key, recMarked(e)])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });
});

describe('given evaluations that interleave', () => {
  it('a pending marked big segment evaluation does not leak into an interleaved one', async () => {
    const big = (key: string) => ({ key, version: 1, unbounded: true, generation: 1 });
    const membership = {
      [makeBigSegmentRef(big('b1'))]: true,
      [makeBigSegmentRef(big('b2'))]: true,
    };
    const { data, queries, evaluator } = setup(
      { f1: segFlag('f1', ['b1']), f2: segFlag('f2', ['b2']), f3: flag('f3') },
      { b1: big('b1'), b2: big('b2') },
      { segments: ['b1'] },
      membership,
    );
    const ctx1 = Context.fromLDContext({ kind: 'user', key: 'u1' });
    const ctx2 = Context.fromLDContext({ kind: 'user', key: 'u2' });
    queries.gates.u1 = deferred();
    queries.gates.u2 = deferred();
    const p1 = evaluator.evaluate(data.flags.f1, ctx1);
    const p2 = evaluator.evaluate(data.flags.f2, ctx2);
    const r3 = await evaluator.evaluate(data.flags.f3, ctx1);
    queries.gates.u2.resolve();
    const r2 = await p2;
    queries.gates.u1.resolve();
    const r1 = await p1;
    expect([marked(r1), marked(r2), marked(r3)]).toEqual([true, false, false]);
  });
});
