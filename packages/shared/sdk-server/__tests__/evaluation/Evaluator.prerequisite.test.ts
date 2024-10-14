import { Context, deserializePoll } from '../../src';
import { BigSegmentStoreMembership } from '../../src/api/interfaces';
import { Flag } from '../../src/evaluation/data/Flag';
import { Segment } from '../../src/evaluation/data/Segment';
import Evaluator from '../../src/evaluation/Evaluator';
import { Queries } from '../../src/evaluation/Queries';
import EventFactory from '../../src/events/EventFactory';
import { FlagsAndSegments } from '../../src/store/serialization';
import { createBasicPlatform } from '../createBasicPlatform';

describe('given a flag payload with prerequisites', () => {
  let evaluator: Evaluator;
  const basePayload = {
    segments: {},
    flags: {
      'has-prereq-depth-1': {
        key: 'has-prereq-depth-1',
        on: true,
        prerequisites: [
          {
            key: 'is-prereq',
            variation: 0,
          },
        ],
        fallthrough: {
          variation: 0,
        },
        offVariation: 1,
        variations: [true, false],
        clientSideAvailability: {
          usingMobileKey: true,
          usingEnvironmentId: true,
        },
        clientSide: true,
        version: 4,
      },
      'has-prereq-depth-2': {
        key: 'has-prereq-depth-2',
        on: true,
        prerequisites: [
          {
            key: 'has-prereq-depth-1',
            variation: 0,
          },
        ],
        fallthrough: {
          variation: 0,
        },
        offVariation: 1,
        variations: [true, false],
        clientSideAvailability: {
          usingMobileKey: true,
          usingEnvironmentId: true,
        },
        clientSide: true,
        version: 3,
      },
      'has-prereq-depth-3': {
        key: 'has-prereq-depth-3',
        on: true,
        prerequisites: [
          {
            key: 'has-prereq-depth-1',
            variation: 0,
          },
          {
            key: 'has-prereq-depth-2',
            variation: 0,
          },
          {
            key: 'is-prereq',
            variation: 0,
          },
        ],
        fallthrough: {
          variation: 0,
        },
        offVariation: 1,
        variations: [true, false],
        clientSideAvailability: {
          usingMobileKey: true,
          usingEnvironmentId: true,
        },
        clientSide: true,
        version: 3,
      },
      'is-prereq': {
        key: 'is-prereq',
        on: true,
        fallthrough: {
          variation: 0,
        },
        offVariation: 1,
        variations: [true, false],
        clientSideAvailability: {
          usingMobileKey: true,
          usingEnvironmentId: true,
        },
        clientSide: true,
        version: 3,
      },
    },
  };

  let testPayload: FlagsAndSegments;

  class TestQueries implements Queries {
    constructor(private readonly _data: FlagsAndSegments) {}

    getFlag(key: string, cb: (flag: Flag | undefined) => void): void {
      const res = this._data.flags[key];
      cb(res);
    }

    getSegment(key: string, cb: (segment: Segment | undefined) => void): void {
      const res = this._data.segments[key];
      cb(res);
    }

    getBigSegmentsMembership(
      _userKey: string,
    ): Promise<[BigSegmentStoreMembership | null, string] | undefined> {
      throw new Error('Method not implemented.');
    }
  }

  beforeEach(() => {
    testPayload = deserializePoll(JSON.stringify(basePayload))!;
    evaluator = new Evaluator(createBasicPlatform(), new TestQueries(testPayload!));
  });

  it('can track prerequisites for a basic prereq', async () => {
    const res = await evaluator.evaluate(
      testPayload?.flags['has-prereq-depth-1']!,
      Context.fromLDContext({ kind: 'user', key: 'bob' }),
      new EventFactory(true),
    );

    expect(res.detail.reason.kind).toEqual('FALLTHROUGH');

    expect(res.prerequisites).toEqual(['is-prereq']);
  });

  it('can track prerequisites for a prereq of a prereq', async () => {
    const res = await evaluator.evaluate(
      testPayload?.flags['has-prereq-depth-2']!,
      Context.fromLDContext({ kind: 'user', key: 'bob' }),
      new EventFactory(true),
    );

    expect(res.detail.reason.kind).toEqual('FALLTHROUGH');

    expect(res.prerequisites).toEqual(['has-prereq-depth-1']);
  });

  it('can track prerequisites for a flag with multiple prereqs with and without additional prereqs', async () => {
    const res = await evaluator.evaluate(
      testPayload?.flags['has-prereq-depth-3']!,
      Context.fromLDContext({ kind: 'user', key: 'bob' }),
      new EventFactory(true),
    );

    expect(res.detail.reason.kind).toEqual('FALLTHROUGH');

    expect(res.prerequisites).toEqual(['has-prereq-depth-1', 'has-prereq-depth-2', 'is-prereq']);
  });

  it('has can handle a prerequisite failure', async () => {
    testPayload.flags['is-prereq'].on = false;
    const res = await evaluator.evaluate(
      testPayload?.flags['has-prereq-depth-3']!,
      Context.fromLDContext({ kind: 'user', key: 'bob' }),
      new EventFactory(true),
    );

    expect(res.detail.reason.kind).toEqual('PREREQUISITE_FAILED');
    expect(res.detail.reason.prerequisiteKey).toEqual('has-prereq-depth-1');

    expect(res.prerequisites).toEqual(['has-prereq-depth-1']);
  });
});
