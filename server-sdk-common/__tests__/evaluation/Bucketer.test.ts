// Because we are not providing a sha1 implementation within the SDK common
// We cannot fully validate bucketing in the common tests. Platform implementations
// should contain a consistency test.
// Testing here can only validate we are providing correct inputs to the hashing algorithm.

import { Context, LDContext } from '@launchdarkly/js-sdk-common';
import AttributeReference from '@launchdarkly/js-sdk-common/dist/AttributeReference';
import Bucketer from '../../src/evaluation/Bucketer';
import { crypto, hasher } from './hasher';

describe.each<[
  context: LDContext,
  key: string,
  attr: string,
  salt: string,
  isExperiment: boolean,
  kindForRollout: string | undefined,
  seed: number | undefined,
  expected: string,
]>([
  [
    { key: 'is-key' },
    'flag-key',
    'key',
    'salty',
    false,
    undefined,
    undefined,
    'flag-key.salty.is-key',
  ],
  // No specified kind, and user, are equivalent.
  [
    { key: 'is-key' },
    'flag-key',
    'key',
    'salty',
    false,
    'user',
    undefined,
    'flag-key.salty.is-key',
  ],
  [{ key: 'is-key', secondary: 'secondary' },
    'flag-key',
    'key',
    'salty',
    false,
    undefined,
    undefined,
    'flag-key.salty.is-key.secondary',
  ],
  [{ key: 'is-key', secondary: 'secondary' },
    'flag-key',
    'key',
    'salty',
    true,
    undefined,
    undefined,
    'flag-key.salty.is-key',
  ],

  [{ key: 'is-key' },
    'flag-key',
    'key',
    'salty',
    false,
    undefined,
    82,
    '82.is-key',
  ],
  [{ key: 'is-key', secondary: 'secondary' },
    'flag-key',
    'key',
    'salty',
    false,
    undefined,
    82,
    '82.is-key.secondary',
  ],
  [
    { key: 'is-key', kind: 'org' },
    'flag-key',
    'key',
    'salty',
    false,
    'org',
    undefined,
    'flag-key.salty.is-key',
  ],
  [
    { key: 'is-key', kind: 'org', integer: 17 },
    'flag-key',
    'integer',
    'salty',
    false,
    'org',
    undefined,
    'flag-key.salty.17',
  ],
  [
    { kind: 'multi', user: { key: 'user-key' }, org: { key: 'org-key' } },
    'flag-key',
    'key',
    'salty',
    false,
    undefined,
    undefined,
    'flag-key.salty.user-key',
  ],
  [
    { kind: 'multi', user: { key: 'user-key' }, org: { key: 'org-key' } },
    'flag-key',
    'key',
    'salty',
    false,
    'org',
    undefined,
    'flag-key.salty.org-key',
  ],
])('given bucketing parameters', (context, key, attr, salt, isExperiment, kindForRollout, seed, expected) => {
  it('hashes the correct string', () => {
    const validatedContext = Context.FromLDContext(context);
    const attrRef = new AttributeReference(attr);

    const bucketer = new Bucketer(crypto);
    // The hasher always returns the same value. This just checks that it converts it to a number
    // in the expected way.
    expect(
      bucketer.bucket(validatedContext!, key, attrRef, salt, isExperiment, kindForRollout, seed),
    ).toBeCloseTo(0.07111111110140983, 5);
    expect(hasher.update).toHaveBeenCalledWith(expected);
    expect(hasher.digest).toHaveBeenCalledWith('hex');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});

describe.each([
  ['org', 'object'],
  ['org', 'array'],
  ['org', 'null'],
  ['bad', 'key'],
])('when given a non string or integer reference', (attr) => {
  it('buckets to 0 when given bad data', () => {
    const validatedContext = Context.FromLDContext({
      key: 'context-key',
      kind: 'org',
      object: {},
      array: [],
      null: null,
    });
    const attrRef = new AttributeReference(attr);

    const bucketer = new Bucketer(crypto);
    expect(bucketer.bucket(validatedContext!, 'key', attrRef, 'salty', false, 'org', undefined)).toEqual(0);
    expect(hasher.update).toBeCalledTimes(0);
    expect(hasher.digest).toBeCalledTimes(0);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
