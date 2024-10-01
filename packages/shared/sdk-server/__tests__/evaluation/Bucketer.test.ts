// Because we are not providing a sha1 implementation within the SDK common
// We cannot fully validate bucketing in the common tests. Platform implementations
// should contain a consistency test.
// Testing here can only validate we are providing correct inputs to the hashing algorithm.
import {
  AttributeReference,
  Context,
  Crypto,
  Hasher,
  LDContext,
} from '@launchdarkly/js-sdk-common';

import Bucketer from '../../src/evaluation/Bucketer';
import { createBasicPlatform } from '../createBasicPlatform';

let mockPlatform: ReturnType<typeof createBasicPlatform>;

beforeEach(() => {
  mockPlatform = createBasicPlatform();
});

describe('Bucketer.test', () => {
  let crypto: Crypto;

  beforeEach(() => {
    crypto = mockPlatform.crypto;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe.each<
    [
      context: LDContext,
      key: string,
      attr: string,
      salt: string,
      kindForRollout: string | undefined,
      seed: number | undefined,
      expected: string,
    ]
  >([
    [{ key: 'is-key' }, 'flag-key', 'key', 'salty', undefined, undefined, 'flag-key.salty.is-key'],
    // No specified kind, and user, are equivalent.
    [{ key: 'is-key' }, 'flag-key', 'key', 'salty', 'user', undefined, 'flag-key.salty.is-key'],
    [{ key: 'is-key' }, 'flag-key', 'key', 'salty', undefined, undefined, 'flag-key.salty.is-key'],

    [{ key: 'is-key' }, 'flag-key', 'key', 'salty', undefined, 82, '82.is-key'],
    [
      { key: 'is-key', kind: 'org' },
      'flag-key',
      'key',
      'salty',
      'org',
      undefined,
      'flag-key.salty.is-key',
    ],
    [
      { key: 'is-key', kind: 'org', integer: 17 },
      'flag-key',
      'integer',
      'salty',
      'org',
      undefined,
      'flag-key.salty.17',
    ],
    [
      { kind: 'multi', user: { key: 'user-key' }, org: { key: 'org-key' } },
      'flag-key',
      'key',
      'salty',
      undefined,
      undefined,
      'flag-key.salty.user-key',
    ],
    [
      { kind: 'multi', user: { key: 'user-key' }, org: { key: 'org-key' } },
      'flag-key',
      'key',
      'salty',
      'org',
      undefined,
      'flag-key.salty.org-key',
    ],
  ])('given bucketing parameters', (context, key, attr, salt, kindForRollout, seed, expected) => {
    it('hashes the correct string', () => {
      const hasher = {
        update: jest.fn((): Hasher => hasher),
        digest: jest.fn(() => '1234567890123456'),
      };
      mockPlatform.crypto.createHash.mockReturnValue(hasher);

      const validatedContext = Context.fromLDContext(context);
      const attrRef = new AttributeReference(attr);

      const bucketer = new Bucketer(crypto);
      const [bucket, hadContext] = bucketer.bucket(
        validatedContext!,
        key,
        attrRef,
        salt,
        kindForRollout,
        seed,
      );

      // The mocks.hasher always returns the same value. This just checks that it converts it to a number
      // in the expected way.
      expect(bucket).toBeCloseTo(0.07111111110140983, 5);
      expect(hadContext).toBeTruthy();
      expect(hasher.update).toHaveBeenCalledWith(expected);
      expect(hasher.digest).toHaveBeenCalledWith('hex');
    });
  });

  describe.each([
    ['org', 'object'],
    ['org', 'array'],
    ['org', 'null'],
    ['bad', 'key'],
  ])('when given a non string or integer reference', (kind, attr) => {
    it('buckets to 0 when given bad data', () => {
      const hasher = {
        update: jest.fn((): Hasher => hasher),
        digest: jest.fn(() => 'digested1'),
      };
      mockPlatform.crypto.createHash.mockReturnValue(hasher);

      const validatedContext = Context.fromLDContext({
        key: 'context-key',
        kind,
        object: {},
        array: [],
        null: null,
      });
      const attrRef = new AttributeReference(attr);

      const bucketer = new Bucketer(crypto);
      const [bucket, hadContext] = bucketer.bucket(
        validatedContext!,
        'key',
        attrRef,
        'salty',
        'org',
        undefined,
      );
      expect(bucket).toEqual(0);
      expect(hadContext).toEqual(kind === 'org');
      expect(hasher.update).toHaveBeenCalledTimes(0);
      expect(hasher.digest).toHaveBeenCalledTimes(0);
    });
  });
});
