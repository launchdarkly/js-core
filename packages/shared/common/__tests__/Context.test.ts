import AttributeReference from '../src/AttributeReference';
import Context from '../src/Context';
import { setupCrypto } from './setupCrypto';

// A sample of invalid characters.
const invalidSampleChars = [
  ...`#$%&'()*+,/:;<=>?@[\\]^\`{|}~ ¡¢£¤¥¦§¨©ª«¬­®¯°±²
³´µ¶·¸¹º»¼½¾¿À汉字`,
];
const badKinds = invalidSampleChars.map((char) => ({ kind: char, key: 'test' }));

describe.each([
  {},
  { kind: 'kind', key: 'kind' },
  { kind: {}, key: 'key' },
  { kind: 17, key: 'key' },
  { kind: 'multi', key: 'key' },
  { kind: 'multi', bad: 'value' },
  { kind: 'multi', 'p@rty': 'value' },
  {
    kind: 'multi',
    bad: {
      key: 17,
    },
  },
  ...badKinds,
])('given invalid LDContext', (ldContext) => {
  it(`should not create a context ${JSON.stringify(ldContext)}`, () => {
    // Force TS to accept our bad contexts.
    // @ts-ignore
    expect(Context.fromLDContext(ldContext).valid).toBeFalsy();
  });
});

describe.each([
  {
    key: 'test',
    name: 'context name',
    custom: { cat: 'calico', '/dog~~//': 'lab' },
    anonymous: true,
    privateAttributeNames: ['/dog~~//'],
  },
  {
    kind: 'user',
    key: 'test',
    name: 'context name',
    cat: 'calico',
    anonymous: true,
    _meta: { privateAttributes: ['/~1dog~0~0~1~1'] },
  },
  {
    kind: 'multi',
    user: {
      key: 'test',
      cat: 'calico',
      anonymous: true,
      name: 'context name',
      _meta: { privateAttributes: ['/~1dog~0~0~1~1'] },
    },
  },
])('given a series of equivalent good user contexts', (ldConext) => {
  // Here we are providing good contexts, but the types derived from
  // the parameterization are causing some problems.
  // @ts-ignore
  const context = Context.fromLDContext(ldConext);

  it('should create a context', () => {
    expect(context).toBeDefined();
  });

  it('should get the same values', () => {
    expect(context?.valueForKind(new AttributeReference('cat'), 'user')).toEqual('calico');
    expect(context?.valueForKind(new AttributeReference('name'), 'user')).toEqual('context name');
    expect(context?.kinds).toStrictEqual(['user']);
    expect(context?.kindsAndKeys).toStrictEqual({ user: 'test' });
    // Canonical keys for 'user' contexts are just the key.
    expect(context?.canonicalKey).toEqual('test');
    expect(context?.valueForKind(new AttributeReference('anonymous'), 'user')).toBeTruthy();
    expect(context?.isMultiKind).toBeFalsy();
    expect(context?.privateAttributes('user')?.[0].redactionName).toEqual(
      new AttributeReference('/~1dog~0~0~1~1').redactionName,
    );
  });

  it('should not get values for a context kind that does not exist', () => {
    expect(context?.valueForKind(new AttributeReference('cat'), 'org')).toBeUndefined();
  });

  it('should have the correct kinds', () => {
    expect(context?.kinds).toEqual(['user']);
  });

  it('should have the correct kinds and keys', () => {
    expect(context?.kindsAndKeys).toEqual({ user: 'test' });
  });
});

describe('given a valid legacy user without custom attributes', () => {
  const context = Context.fromLDContext({
    key: 'test',
    name: 'context name',
    custom: { cat: 'calico', '/dog~~//': 'lab' },
    anonymous: true,
    privateAttributeNames: ['/dog~~//'],
  });

  it('should create a context', () => {
    expect(context).toBeDefined();
  });

  it('should get expected values', () => {
    expect(context?.valueForKind(new AttributeReference('name'), 'user')).toEqual('context name');
    expect(context?.kinds).toStrictEqual(['user']);
    expect(context?.kindsAndKeys).toStrictEqual({ user: 'test' });
    // Canonical keys for 'user' contexts are just the key.
    expect(context?.canonicalKey).toEqual('test');
    expect(context?.valueForKind(new AttributeReference('anonymous'), 'user')).toBeTruthy();
    expect(context?.isMultiKind).toBeFalsy();
    expect(context?.privateAttributes('user')?.[0].redactionName).toEqual(
      new AttributeReference('/~1dog~0~0~1~1').redactionName,
    );
  });
});

describe.each([
  ['Org:%Key%', 'org:Org%3A%25Key%25'],
  ['Org:Key', 'org:Org%3AKey'],
  ['Org%Key', 'org:Org%25Key'],
])('given a non-user single kind context', (key, encoded) => {
  const context = Context.fromLDContext({
    kind: 'org',
    // Key will be URL encoded.
    key,
    value: 'OrgValue',
  });
  it('should have the correct canonical key', () => {
    expect(context?.canonicalKey).toEqual(encoded);
  });

  it('should have the correct kinds', () => {
    expect(context?.kinds).toEqual(['org']);
  });

  it('should have the correct kinds and keys', () => {
    expect(context?.kindsAndKeys).toEqual({ org: key });
  });
});

describe('given a multi-kind context', () => {
  const context = Context.fromLDContext({
    kind: 'multi',

    user: {
      key: 'User%:/Key',
      // Key will be URL encoded.
      value: 'UserValue',
    },
    org: {
      key: 'OrgKey',
      value: 'OrgValue',
    },
  });

  it('should have the correct canonical key', () => {
    expect(context?.canonicalKey).toEqual('org:OrgKey:user:User%25%3A/Key');
  });

  it('should get values from the correct context', () => {
    expect(context?.valueForKind(new AttributeReference('value'), 'org')).toEqual('OrgValue');
    expect(context?.valueForKind(new AttributeReference('value'), 'user')).toEqual('UserValue');
  });

  it('should have the correct kinds', () => {
    expect(context?.kinds.sort()).toEqual(['org', 'user']);
  });

  it('should have the correct kinds and keys', () => {
    expect(context?.kindsAndKeys).toEqual({ org: 'OrgKey', user: 'User%:/Key' });
  });
});

describe('given a user context with private attributes', () => {
  const input = Context.fromLDContext({
    key: 'testKey',
    name: 'testName',
    custom: { cat: 'calico', dog: 'lab' },
    anonymous: true,
    privateAttributeNames: ['/a/b/c', 'cat', 'custom/dog'],
  });

  const expected = {
    key: 'testKey',
    kind: 'user',
    name: 'testName',
    cat: 'calico',
    dog: 'lab',
    anonymous: true,
    _meta: {
      privateAttributes: ['/a/b/c', 'cat', 'custom/dog'],
    },
  };

  it('it can convert from LDContext to Context and back to LDContext', () => {
    expect(Context.toLDContext(input)).toEqual(expected);
  });
});

describe('given a user context without private attributes', () => {
  const input = Context.fromLDContext({
    key: 'testKey',
    name: 'testName',
    custom: { cat: 'calico', dog: 'lab' },
    anonymous: true,
  });

  const expected = {
    key: 'testKey',
    kind: 'user',
    name: 'testName',
    cat: 'calico',
    dog: 'lab',
    anonymous: true,
  };

  it('it can convert from LDContext to Context and back to LDContext', () => {
    expect(Context.toLDContext(input)).toEqual(expected);
  });
});

describe('given a single context with private attributes', () => {
  const input = Context.fromLDContext({
    kind: 'org',
    key: 'testKey',
    name: 'testName',
    cat: 'calico',
    dog: 'lab',
    anonymous: true,
    _meta: {
      privateAttributes: ['/a/b/c', 'cat', 'dog'],
    },
  });

  const expected = {
    kind: 'org',
    key: 'testKey',
    name: 'testName',
    cat: 'calico',
    dog: 'lab',
    anonymous: true,
    _meta: {
      privateAttributes: ['/a/b/c', 'cat', 'dog'],
    },
  };

  it('it can convert from LDContext to Context and back to LDContext', () => {
    expect(Context.toLDContext(input)).toEqual(expected);
  });
});

describe('given a single context without meta', () => {
  const input = Context.fromLDContext({
    kind: 'org',
    key: 'testKey',
    name: 'testName',
    cat: 'calico',
    dog: 'lab',
    anonymous: true,
  });

  const expected = {
    kind: 'org',
    key: 'testKey',
    name: 'testName',
    cat: 'calico',
    dog: 'lab',
    anonymous: true,
  };

  it('it can convert from LDContext to Context and back to LDContext', () => {
    expect(Context.toLDContext(input)).toEqual(expected);
  });
});

describe('given a multi context', () => {
  const input = Context.fromLDContext({
    kind: 'multi',
    org: {
      key: 'testKey',
      name: 'testName',
      cat: 'calico',
      dog: 'lab',
      anonymous: true,
      _meta: {
        privateAttributes: ['/a/b/c', 'cat', 'custom/dog'],
      },
    },
    customer: {
      key: 'testKey',
      name: 'testName',
      bird: 'party parrot',
      chicken: 'hen',
    },
  });

  const expected = {
    kind: 'multi',
    org: {
      key: 'testKey',
      name: 'testName',
      cat: 'calico',
      dog: 'lab',
      anonymous: true,
      _meta: {
        privateAttributes: ['/a/b/c', 'cat', 'custom/dog'],
      },
    },
    customer: {
      key: 'testKey',
      name: 'testName',
      bird: 'party parrot',
      chicken: 'hen',
    },
  };

  it('it can convert from LDContext to Context and back to LDContext', () => {
    expect(Context.toLDContext(input)).toEqual(expected);
  });
});

describe('given mock crypto', () => {
  const crypto = setupCrypto();

  it('hashes two equal contexts the same', async () => {
    const a = Context.fromLDContext({
      kind: 'multi',
      org: {
        key: 'testKey',
        name: 'testName',
        cat: 'calico',
        dog: 'lab',
        anonymous: true,
        _meta: {
          privateAttributes: ['/a/b/c', 'cat', 'custom/dog'],
        },
      },
      customer: {
        key: 'testKey',
        name: 'testName',
        bird: 'party parrot',
        chicken: 'hen',
      },
    });

    const b = Context.fromLDContext({
      kind: 'multi',
      org: {
        key: 'testKey',
        name: 'testName',
        cat: 'calico',
        dog: 'lab',
        anonymous: true,
        _meta: {
          privateAttributes: ['/a/b/c', 'cat', 'custom/dog'],
        },
      },
      customer: {
        key: 'testKey',
        name: 'testName',
        bird: 'party parrot',
        chicken: 'hen',
      },
    });
    expect(await a.hash(crypto)).toEqual(await b.hash(crypto));
  });

  it('hashes legacy and non-legacy equivalent contexts the same', async () => {
    const legacy = Context.fromLDContext({
      key: 'testKey',
      name: 'testName',
      custom: { cat: 'calico', dog: 'lab' },
      anonymous: true,
      privateAttributeNames: ['cat', 'dog'],
    });

    const nonLegacy = Context.fromLDContext({
      kind: 'user',
      key: 'testKey',
      name: 'testName',
      cat: 'calico',
      dog: 'lab',
      anonymous: true,
      _meta: {
        privateAttributes: ['cat', 'dog'],
      },
    });

    expect(await legacy.hash(crypto)).toEqual(await nonLegacy.hash(crypto));
  });

  it('hashes single context and multi-context with one kind the same', async () => {
    const single = Context.fromLDContext({
      kind: 'org',
      key: 'testKey',
      name: 'testName',
      value: 'testValue',
    });

    const multi = Context.fromLDContext({
      kind: 'multi',
      org: {
        key: 'testKey',
        name: 'testName',
        value: 'testValue',
      },
    });

    expect(await single.hash(crypto)).toEqual(await multi.hash(crypto));
  });

  it('handles shared references without getting stuck', async () => {
    const sharedObject = { value: 'shared' };
    const context = Context.fromLDContext({
      kind: 'multi',
      org: {
        key: 'testKey',
        shared: sharedObject,
      },
      user: {
        key: 'testKey',
        shared: sharedObject,
      },
    });

    const hash = await context.hash(crypto);
    expect(hash).toBeDefined();
  });

  it('returns undefined for contexts with cycles', async () => {
    const cyclicObject: any = { value: 'cyclic' };
    cyclicObject.self = cyclicObject;

    const context = Context.fromLDContext({
      kind: 'user',
      key: 'testKey',
      cyclic: cyclicObject,
    });

    expect(await context.hash(crypto)).toBeUndefined();
  });

  it('handles nested objects correctly', async () => {
    const context = Context.fromLDContext({
      kind: 'user',
      key: 'testKey',
      nested: {
        level1: {
          level2: {
            value: 'deep',
          },
        },
      },
    });

    const hash = await context.hash(crypto);
    expect(hash).toBeDefined();
  });

  it('handles arrays correctly', async () => {
    const context = Context.fromLDContext({
      kind: 'user',
      key: 'testKey',
      array: [1, 2, 3],
      nestedArray: [
        [1, 2],
        [3, 4],
      ],
    });

    const hash = await context.hash(crypto);
    expect(hash).toBeDefined();
  });

  it('handles primitive values correctly', async () => {
    const context = Context.fromLDContext({
      kind: 'user',
      key: 'testKey',
      string: 'test',
      number: 42,
      boolean: true,
      nullValue: null,
      undefinedValue: undefined,
    });

    const hash = await context.hash(crypto);
    expect(hash).toBeDefined();
  });

  it('includes private attributes in hash calculation', async () => {
    const baseContext = {
      kind: 'user',
      key: 'testKey',
      name: 'testName',
      nested: {
        value: 'testValue',
      },
    };

    const contextWithPrivate = Context.fromLDContext({
      ...baseContext,
      _meta: {
        privateAttributes: ['name', 'nested/value'],
      },
    });

    const contextWithoutPrivate = Context.fromLDContext(baseContext);

    const hashWithPrivate = await contextWithPrivate.hash(crypto);
    const hashWithoutPrivate = await contextWithoutPrivate.hash(crypto);

    // The hashes should be different because private attributes are included in the hash
    expect(hashWithPrivate).not.toEqual(hashWithoutPrivate);
  });

  it('uses the keys the keys of attributes in the hash', async () => {
    const a = Context.fromLDContext({
      kind: 'user',
      key: 'testKey',
      a: 'b',
    });

    const b = Context.fromLDContext({
      kind: 'user',
      key: 'testKey',
      b: 'b',
    });

    const hashA = await a.hash(crypto);
    const hashB = await b.hash(crypto);
    expect(hashA).not.toBe(hashB);
  });

  it('uses the keys of nested objects inside the hash', async () => {
    const a = Context.fromLDContext({
      kind: 'user',
      key: 'testKey',
      nested: {
        level1: {
          level2: {
            value: 'deep',
          },
        },
      },
    });

    const b = Context.fromLDContext({
      kind: 'user',
      key: 'testKey',
      nested: {
        sub1: {
          sub2: {
            value: 'deep',
          },
        },
      },
    });

    const hashA = await a.hash(crypto);
    const hashB = await b.hash(crypto);
    expect(hashA).not.toBe(hashB);
  });

  it('it uses the values of nested array in calculations', async () => {
    const a = Context.fromLDContext({
      kind: 'user',
      key: 'testKey',
      array: [1, 2, 3],
      nestedArray: [
        [1, 2],
        [3, 4],
      ],
    });

    const b = Context.fromLDContext({
      kind: 'user',
      key: 'testKey',
      array: [1, 2, 3],
      nestedArray: [
        [2, 1],
        [3, 4],
      ],
    });

    const hashA = await a.hash(crypto);
    const hashB = await b.hash(crypto);
    expect(hashA).not.toBe(hashB);
  });

  it('uses the values of nested objects inside the hash', async () => {
    const a = Context.fromLDContext({
      kind: 'user',
      key: 'testKey',
      nested: {
        level1: {
          level2: {
            value: 'deep',
          },
        },
      },
    });

    const b = Context.fromLDContext({
      kind: 'user',
      key: 'testKey',
      nested: {
        level1: {
          level2: {
            value: 'deeper',
          },
        },
      },
    });

    const hashA = await a.hash(crypto);
    const hashB = await b.hash(crypto);
    expect(hashA).not.toBe(hashB);
  });

  it('hashes _meta in attributes', async () => {
    const a = Context.fromLDContext({
      kind: 'user',
      key: 'testKey',
      nested: {
        level1: {
          level2: {
            _meta: { test: 'a' },
          },
        },
      },
    });

    const b = Context.fromLDContext({
      kind: 'user',
      key: 'testKey',
      nested: {
        level1: {
          level2: {
            _meta: { test: 'b' },
          },
        },
      },
    });

    const hashA = await a.hash(crypto);
    const hashB = await b.hash(crypto);
    expect(hashA).not.toBe(hashB);
  });

  it('produces the same value for the given context', async () => {
    // This isn't so much a test as it is a detection of change.
    // If this test failed, and you didn't expect it, then you probably need to make sure your
    // change makes sense.
    const complexContext = Context.fromLDContext({
      kind: 'multi',
      org: {
        key: 'testKey',
        name: 'testName',
        cat: 'calico',
        dog: 'lab',
        anonymous: true,
        nestedArray: [
          [1, 2],
          [3, 4],
        ],
        _meta: {
          privateAttributes: ['/a/b/c', 'cat', 'custom/dog'],
        },
      },
      customer: {
        key: 'testKey',
        name: 'testName',
        bird: 'party parrot',
        chicken: 'hen',
        nested: {
          level1: {
            level2: {
              value: 'deep',
              _meta: { thisShouldBeInTheHash: true },
            },
          },
        },
      },
    });
    expect(await complexContext.hash(crypto)).toBe(
      'customerbirdchickenkeynamenestedorganonymouscatdogkeynamenestedArraya/b/ccatcustom/dog01length201length24301length221testNametestKeylabcalicotruelevel1level2_metavaluedeepthisShouldBeInTheHashtruetestNametestKeyhenparty parrot',
    );
  });
});
