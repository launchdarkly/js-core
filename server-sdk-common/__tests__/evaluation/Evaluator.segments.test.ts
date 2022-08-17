/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { AttributeReference, Context, LDContext } from '@launchdarkly/js-sdk-common';
import { BigSegmentStoreMembership } from '../../src/api/interfaces';
import { Flag } from '../../src/evaluation/data/Flag';
import { Segment } from '../../src/evaluation/data/Segment';
import Evaluator from '../../src/evaluation/Evaluator';
import { Queries } from '../../src/evaluation/Queries';
import { makeClauseThatDoesNotMatchUser, makeClauseThatMatchesUser, makeFlagWithSegmentMatch } from './flags';
import basicPlatform from './mocks/platform';

const basicUser: LDContext = { key: 'userkey' };
const basicSingleKindUser: LDContext = { kind: 'user', key: 'userkey' };
const basicMultiKindUser: LDContext = { kind: 'multi', user: { key: 'userkey' } };

class TestQueries implements Queries {
  constructor(private readonly data: {
    flags?: Flag[],
    segments?: Segment[]
  }) { }

  async getFlag(key: string): Promise<Flag | undefined> {
    return this.data.flags?.find((flag) => flag.key === key);
  }

  async getSegment(key: string): Promise<Segment | undefined> {
    return this.data.segments?.find((segment) => segment.key === key);
  }

  getBigSegmentsMembership(userKey: string):
  Promise<[BigSegmentStoreMembership | null, string] | undefined> {
    throw new Error('Method not implemented.');
  }
}

describe('when evaluating user equivalent contexts for segments', () => {
  const matchClause = makeClauseThatMatchesUser(basicUser);

  it.each([basicUser, basicSingleKindUser, basicMultiKindUser])('matches segment with explicitly included user', async (context) => {
    const segment = {
      key: 'test',
      included: [basicUser.key],
      version: 1,
    };
    const evaluator = new Evaluator(basicPlatform, new TestQueries({ segments: [segment] }));
    const flag = makeFlagWithSegmentMatch(segment);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(context));
    expect(res.detail.value).toBe(true);
  });

  it.each([basicUser, basicSingleKindUser, basicMultiKindUser])('does not match segment with explicitly excluded user', async (context) => {
    const segment = {
      key: 'test',
      excluded: [basicUser.key],
      version: 1,
    };
    const evaluator = new Evaluator(basicPlatform, new TestQueries({ segments: [segment] }));
    const flag = makeFlagWithSegmentMatch(segment);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(context));
    expect(res.detail.value).toBe(false);
  });

  it.each([basicUser, basicSingleKindUser, basicMultiKindUser])('does not match a segment that does not exist', async (context) => {
    const segment = {
      key: 'test',
      excluded: [basicUser.key],
      version: 1,
    };
    const evaluator = new Evaluator(basicPlatform, new TestQueries({ segments: [] }));
    const flag = makeFlagWithSegmentMatch(segment);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(context));
    expect(res.detail.value).toBe(false);
  });

  it('does not match segment with unknown user', async () => {
    const segment = {
      key: 'test',
      included: ['foo'],
      version: 1,
    };
    const evaluator = new Evaluator(basicPlatform, new TestQueries({ segments: [segment] }));
    const flag = makeFlagWithSegmentMatch(segment);
    const user = { key: 'bar' };
    const res = await evaluator.evaluate(flag, Context.fromLDContext(user));
    expect(res.detail.value).toBe(false);
  });

  it.each([basicUser, basicSingleKindUser, basicMultiKindUser])('matches segment with user who is both included and excluded', async (context) => {
    const segment = {
      key: 'test',
      included: [basicUser.key],
      excluded: [basicUser.key],
      version: 1,
    };
    const evaluator = new Evaluator(basicPlatform, new TestQueries({ segments: [segment] }));
    const flag = makeFlagWithSegmentMatch(segment);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(context));
    expect(res.detail.value).toBe(true);
  });

  it.each([basicUser, basicSingleKindUser, basicMultiKindUser])('matches segment with rule with full rollout', async (context) => {
    const segment: Segment = {
      key: 'test',
      rules: [
        {
          id: 'id',
          clauses: [matchClause],
          weight: 100000,
        },
      ],
      version: 1,
    };
    const evaluator = new Evaluator(basicPlatform, new TestQueries({ segments: [segment] }));
    const flag = makeFlagWithSegmentMatch(segment);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(context));
    expect(res.detail.value).toBe(true);
  });

  it('handles an invalid reference for bucketBy', async () => {
    const segment: Segment = {
      key: 'test',
      rules: [
        {
          clauses: [matchClause],
          weight: 100000,
          bucketBy: '//',
          bucketByAttributeReference: new AttributeReference('//'),
          rolloutContextKind: 'user',
          id: 'id',
        },
      ],
      version: 1,
    };
    const evaluator = new Evaluator(basicPlatform, new TestQueries({ segments: [segment] }));
    const flag = makeFlagWithSegmentMatch(segment);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(basicUser));
    expect(res.detail.reason).toEqual({ kind: 'ERROR', errorKind: 'MALFORMED_FLAG' });
    expect(res.detail.value).toBe(null);
  });

  it.each([basicUser, basicSingleKindUser, basicMultiKindUser])('does not match segment with rule with zero rollout', async (context) => {
    const segment: Segment = {
      key: 'test',
      rules: [
        {
          id: 'id',
          clauses: [matchClause],
          weight: 0,
        },
      ],
      version: 1,
    };
    const evaluator = new Evaluator(basicPlatform, new TestQueries({ segments: [segment] }));
    const flag = makeFlagWithSegmentMatch(segment);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(context));
    expect(res.detail.value).toBe(false);
  });

  it('matches segment with multiple matching clauses', async () => {
    const user = { key: 'foo', email: 'test@example.com', name: 'bob' };
    const segment: Segment = {
      key: 'test',
      rules: [
        {
          id: 'id',
          clauses: [
            {
              attribute: 'email',
              attributeReference: new AttributeReference('email', true),
              op: 'in',
              values: [user.email],
            },
            {
              attribute: 'name',
              attributeReference: new AttributeReference('name', true),
              op: 'in',
              values: [user.name],
            },
          ],
        },
      ],
      version: 1,
    };
    const evaluator = new Evaluator(basicPlatform, new TestQueries({ segments: [segment] }));
    const flag = makeFlagWithSegmentMatch(segment);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(user));
    expect(res.detail.value).toBe(true);
  });

  it('does not match segment if one clause does not match', async () => {
    const user = { key: 'foo', email: 'test@example.com', name: 'bob' };
    const segment = {
      key: 'test',
      rules: [
        {
          id: 'id',
          clauses: [makeClauseThatMatchesUser(user), makeClauseThatDoesNotMatchUser(user)],
        },
      ],
      version: 1,
    };
    const evaluator = new Evaluator(basicPlatform, new TestQueries({ segments: [segment] }));
    const flag = makeFlagWithSegmentMatch(segment);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(user));
    expect(res.detail.value).toBe(false);
  });
});

const singleKind: LDContext = { kind: 'org', key: 'orgKey' };
const multiKind: LDContext = { kind: 'multi', org: { key: 'orgKey' } };

describe('Evaluator - segment match for non-user contexts', () => {
  it.each([singleKind, multiKind])('matches segment with explicitly included context', async (context) => {
    const segment = {
      key: 'test',
      includedContexts: [{ contextKind: 'org', values: [singleKind.key] }],
      version: 1,
    };
    const evaluator = new Evaluator(basicPlatform, new TestQueries({ segments: [segment] }));
    const flag = makeFlagWithSegmentMatch(segment);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(context));
    expect(res.detail.value).toBe(true);
  });

  it.each([singleKind, multiKind])('matches nested segments', async (context) => {
    const segment1: Segment = {
      key: 'segment1',
      includedContexts: [{ contextKind: 'org', values: [singleKind.key] }],
      version: 1,
    };
    const segment2: Segment = {
      key: 'segment2',
      rules: [
        {
          id: 'id',
          clauses: [
            {
              attribute: '',
              attributeReference: new AttributeReference(''),
              op: 'segmentMatch',
              values: [segment1.key],
            },
          ],
          weight: 100000,
        },
      ],
      version: 1,
    };
    const evaluator = new Evaluator(
      basicPlatform,
      new TestQueries({ segments: [segment1, segment2] }),
    );
    const flag = makeFlagWithSegmentMatch(segment2);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(context));
    expect(res.detail.value).toBe(true);
  });

  it('does not exceed callstack side for circular segments', async () => {
    const segment: Segment = {
      key: 'segment',
      rules: [
        {
          id: 'id',
          clauses: [
            {
              attribute: '',
              attributeReference: new AttributeReference(''),
              op: 'segmentMatch',
              values: ['segment'],
            }],
          weight: 100000,
        },
      ],
      version: 1,
    };
    const evaluator = new Evaluator(basicPlatform, new TestQueries({ segments: [segment] }));
    const flag = makeFlagWithSegmentMatch(segment);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(singleKind));
    expect(res.detail.reason).toEqual({ kind: 'ERROR', errorKind: 'MALFORMED_FLAG' });
    expect(res.detail.value).toBe(null);
  });

  it('allows for the same segment to be references in multiple clauses', async () => {
    const segment1: Segment = {
      key: 'segment1',
      includedContexts: [{ contextKind: 'org', values: [singleKind.key] }],
      version: 1,
    };
    const segment2: Segment = {
      key: 'segment2',
      rules: [
        {
          id: 'id',
          clauses: [
            {
              attribute: '',
              attributeReference: new AttributeReference(''),
              op: 'segmentMatch',
              values: [segment1.key],
            },
            {
              attribute: '',
              attributeReference: new AttributeReference(''),
              op: 'segmentMatch',
              values: [segment1.key],
            },
          ],
          weight: 100000,
        },
      ],
      version: 1,
    };
    const evaluator = new Evaluator(
      basicPlatform,
      new TestQueries({ segments: [segment1, segment2] }),
    );
    const flag = makeFlagWithSegmentMatch(segment2);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(singleKind));
    expect(res.detail.value).toBe(true);
  });

  it.each([singleKind, multiKind])('does not match segment for matching kind but missing key', async (context) => {
    const segment: Segment = {
      key: 'test',
      includedContexts: [{ contextKind: 'org', values: ['otherKey'] }],
      version: 1,
    };
    const evaluator = new Evaluator(basicPlatform, new TestQueries({ segments: [segment] }));
    const flag = makeFlagWithSegmentMatch(segment);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(context));
    expect(res.detail.value).toBe(false);
  });

  it.each([singleKind, multiKind])('does not match segment with explicitly excluded context', async (context) => {
    const segment: Segment = {
      key: 'test',
      excludedContexts: [{ contextKind: 'org', values: [singleKind.key] }],
      version: 1,
    };
    const evaluator = new Evaluator(basicPlatform, new TestQueries({ segments: [segment] }));
    const flag = makeFlagWithSegmentMatch(segment);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(context));
    expect(res.detail.value).toBe(false);
  });

  it.each([singleKind, multiKind])('does not match segment for wrong kind', async (context) => {
    const segment: Segment = {
      key: 'test',
      includedContexts: [{ contextKind: 'notOrg', values: [singleKind.key] }],
      version: 1,
    };
    const evaluator = new Evaluator(basicPlatform, new TestQueries({ segments: [segment] }));
    const flag = makeFlagWithSegmentMatch(segment);
    const res = await evaluator.evaluate(flag, Context.fromLDContext(context));
    expect(res.detail.value).toBe(false);
  });
});
