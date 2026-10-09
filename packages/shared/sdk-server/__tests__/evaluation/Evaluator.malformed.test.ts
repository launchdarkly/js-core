import { AttributeReference, Context } from '@launchdarkly/js-sdk-common';

import { BigSegmentStoreMembership } from '../../src/api/interfaces';
import { Clause } from '../../src/evaluation/data/Clause';
import { Flag } from '../../src/evaluation/data/Flag';
import { Segment } from '../../src/evaluation/data/Segment';
import EvalResult from '../../src/evaluation/EvalResult';
import Evaluator from '../../src/evaluation/Evaluator';
import { Queries } from '../../src/evaluation/Queries';
import EventFactory from '../../src/events/EventFactory';
import { createBasicPlatform } from '../createBasicPlatform';

// LaunchDarkly never sends these shapes, but a custom store, a data file, or an override can
// hand the evaluator anything. Each test awaits the evaluation directly: if the evaluator threw,
// the promise would reject, and if it never delivered a result, the test would time out.

const userContext = Context.fromLDContext({ key: 'user-key' });

// The definitions are deliberately malformed, so they are built as plain objects and cast
// rather than typed as Flag or Segment.
function makeFlag(overrides: Record<string, unknown>): Flag {
  return {
    key: 'malformed-flag',
    version: 1,
    on: true,
    fallthrough: { variation: 1 },
    variations: ['zero', 'one'],
    ...overrides,
  } as unknown as Flag;
}

function makeClause(overrides: Record<string, unknown>): Clause {
  return {
    attribute: 'key',
    attributeReference: new AttributeReference('key'),
    op: 'in',
    values: ['user-key'],
    contextKind: 'user',
    ...overrides,
  } as unknown as Clause;
}

function makeSegment(overrides: Record<string, unknown>): Segment {
  return { key: 'segment', version: 1, ...overrides } as unknown as Segment;
}

function makeFlagMatchingSegment(segmentKey: string): Flag {
  return makeFlag({
    rules: [
      {
        id: 'rule',
        variation: 0,
        clauses: [makeClause({ op: 'segmentMatch', values: [segmentKey] })],
      },
    ],
  });
}

class TestQueries implements Queries {
  constructor(
    private readonly _data: {
      flags?: Flag[];
      segments?: Segment[];
      membership?: BigSegmentStoreMembership;
    },
    private readonly _callsBackAsync: boolean = false,
  ) {}

  getFlag(key: string, cb: (flag: Flag | undefined) => void): void {
    this._deliver(() => cb(this._data.flags?.find((flag) => flag.key === key)));
  }

  getSegment(key: string, cb: (segment: Segment | undefined) => void): void {
    this._deliver(() => cb(this._data.segments?.find((segment) => segment.key === key)));
  }

  getBigSegmentsMembership(): Promise<[BigSegmentStoreMembership | null, string] | undefined> {
    const result: [BigSegmentStoreMembership | null, string] = [
      this._data.membership ?? null,
      'HEALTHY',
    ];
    return Promise.resolve(result);
  }

  // A store backed by a database calls back after its own promise resolves, which takes the
  // evaluator off the stack of the call that started the evaluation.
  private _deliver(fn: () => void): void {
    if (this._callsBackAsync) {
      Promise.resolve().then(fn);
    } else {
      fn();
    }
  }
}

function expectMalformed(result: EvalResult) {
  expect(result.isError).toBe(true);
  expect(result.detail).toMatchObject({
    value: null,
    variationIndex: null,
    reason: { kind: 'ERROR', errorKind: 'MALFORMED_FLAG' },
  });
}

describe('given an evaluator and flag definitions it cannot read', () => {
  let evaluator: Evaluator;

  beforeEach(() => {
    evaluator = new Evaluator(createBasicPlatform(), new TestQueries({}));
  });

  it('returns a malformed flag result for a flag with no variations', async () => {
    const result = await evaluator.evaluate(makeFlag({ variations: undefined }), userContext);
    expectMalformed(result);
    expect(result.message).toBe('Flag variations are not an array');
  });

  it('returns a malformed flag result when variations are not an array', async () => {
    // A string has a length and can be indexed, so without an explicit check one of its
    // characters would be served as the flag value.
    const result = await evaluator.evaluate(makeFlag({ variations: 'abc' }), userContext);
    expectMalformed(result);
    expect(result.message).toBe('Flag variations are not an array');
  });

  it('returns a malformed flag result for a rule whose clauses are not an array', async () => {
    // A rule with no clauses at all is treated as not matching. Clauses that are present but
    // not a list cannot be iterated, and an object would otherwise match every context.
    const flag = makeFlag({ rules: [{ id: 'rule', variation: 0, clauses: {} }] });
    const result = await evaluator.evaluate(flag, userContext);
    expectMalformed(result);
    expect(result.message).toContain('Flag "malformed-flag" has a malformed definition');
    expect(result.message).toContain('Expected an array but received object');
  });

  it('returns a malformed flag result for a clause with no values', async () => {
    const flag = makeFlag({
      rules: [{ id: 'rule', variation: 0, clauses: [makeClause({ values: undefined })] }],
    });
    const result = await evaluator.evaluate(flag, userContext);
    expectMalformed(result);
    expect(result.message).toContain('Flag "malformed-flag" has a malformed definition');
  });

  it('returns a malformed flag result for a target with no values', async () => {
    const flag = makeFlag({ targets: [{ variation: 0 }] });
    const result = await evaluator.evaluate(flag, userContext);
    expectMalformed(result);
    expect(result.message).toContain('Flag "malformed-flag" has a malformed definition');
  });

  it('returns a malformed flag result for a context target with no values', async () => {
    // A context target is only read for a context of its kind.
    const flag = makeFlag({ contextTargets: [{ contextKind: 'org', variation: 0 }] });
    const orgContext = Context.fromLDContext({ kind: 'org', key: 'org-key' });
    const result = await evaluator.evaluate(flag, orgContext);
    expectMalformed(result);
    expect(result.message).toContain('Flag "malformed-flag" has a malformed definition');
  });

  it('delivers the result once and propagates an exception thrown by the receiving callback', () => {
    // The guards are for exceptions raised while reading the definition. One raised by the
    // caller after the result was delivered is not a flag problem and must stay visible, and
    // it must not cause the result to be delivered a second time on its way out.
    const flag = makeFlag({
      rules: [{ id: 'rule', variation: 0, clauses: [makeClause({ values: undefined })] }],
    });
    const cb = jest.fn(() => {
      throw new Error('from the caller');
    });
    expect(() => {
      evaluator.evaluateCb(flag, userContext, cb);
    }).toThrow('from the caller');
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe.each([
  ['synchronously', false],
  ['asynchronously', true],
])('given a store that calls back %s', (_description, callsBackAsync) => {
  it('returns a malformed flag result for a segment whose included list is not an array', async () => {
    const segment = makeSegment({ included: {} });
    const evaluator = new Evaluator(
      createBasicPlatform(),
      new TestQueries({ segments: [segment] }, callsBackAsync),
    );
    const result = await evaluator.evaluate(makeFlagMatchingSegment(segment.key), userContext);
    expectMalformed(result);
    expect(result.message).toContain('Flag "malformed-flag" has a malformed definition');
  });

  it('returns a malformed flag result for a segment rule clause with no values', async () => {
    const segment = makeSegment({ rules: [{ clauses: [makeClause({ values: undefined })] }] });
    const evaluator = new Evaluator(
      createBasicPlatform(),
      new TestQueries({ segments: [segment] }, callsBackAsync),
    );
    const result = await evaluator.evaluate(makeFlagMatchingSegment(segment.key), userContext);
    expectMalformed(result);
    expect(result.message).toContain('Flag "malformed-flag" has a malformed definition');
  });

  it('returns a malformed flag result for the parent of a malformed prerequisite', async () => {
    const prerequisite = makeFlag({ key: 'prerequisite', targets: [{ variation: 0 }] });
    const parent = makeFlag({
      key: 'parent',
      prerequisites: [{ key: 'prerequisite', variation: 1 }],
    });
    const evaluator = new Evaluator(
      createBasicPlatform(),
      new TestQueries({ flags: [prerequisite] }, callsBackAsync),
    );
    const result = await evaluator.evaluate(parent, userContext, new EventFactory(true));
    expectMalformed(result);
    expect(result.message).toContain('Flag "parent" has a malformed definition');
    // The prerequisite never produced a result, so there is no evaluation to record for it
    // and no event to send. Recording it without an event would misreport what ran.
    expect(result.prerequisites).toBeUndefined();
    expect(result.events).toBeUndefined();
  });
});

describe('given an unbounded segment whose rules cannot be read', () => {
  // Big segment membership is looked up through a promise, so the rest of the evaluation
  // runs inside promise continuations rather than on the caller's stack.
  const segment = makeSegment({
    unbounded: true,
    generation: 1,
    rules: [{ clauses: [makeClause({ values: undefined })] }],
  });
  let evaluator: Evaluator;

  beforeEach(() => {
    evaluator = new Evaluator(
      createBasicPlatform(),
      new TestQueries({ segments: [segment], membership: {} }),
    );
  });

  it('returns a malformed flag result instead of an unhandled rejection', async () => {
    const result = await evaluator.evaluate(makeFlagMatchingSegment(segment.key), userContext);
    expectMalformed(result);
    expect(result.message).toContain('Flag "malformed-flag" has a malformed definition');
    // The error result carries the state gathered before the failure, like other errors do.
    expect(result.detail.reason.bigSegmentsStatus).toBe('HEALTHY');
  });
});

describe('given a big segment lookup that rejects', () => {
  // The big segments manager turns store failures into a status, so a rejection here would be
  // a bug. Before the guard it was an unhandled rejection and the evaluation never finished.
  const segment = makeSegment({ unbounded: true, generation: 1 });

  class RejectingQueries extends TestQueries {
    override getBigSegmentsMembership(): Promise<
      [BigSegmentStoreMembership | null, string] | undefined
    > {
      return Promise.reject(new Error('lookup failed'));
    }
  }

  it('returns a malformed flag result carrying the rejection message', async () => {
    const evaluator = new Evaluator(
      createBasicPlatform(),
      new RejectingQueries({ segments: [segment] }),
    );
    const result = await evaluator.evaluate(makeFlagMatchingSegment(segment.key), userContext);
    expectMalformed(result);
    expect(result.message).toContain('Flag "malformed-flag" has a malformed definition');
    expect(result.message).toContain('lookup failed');
  });
});
