import AttributeReference from '../src/AttributeReference';
import Context from '../src/Context';

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

it('given a invalid context, canonicalUnfilteredJson should return undefined', () => {
  // Force TS to accept our bad contexts
  // @ts-ignore
  const invalidContext = Context.fromLDContext({ kind: 'multi', bad: 'value' });
  expect(invalidContext.valid).toBeFalsy();
  expect(invalidContext.canonicalUnfilteredJson()).toBeUndefined();
});

it('given a context with circular references, canonicalUnfilteredJson should return undefined', () => {
  const circularObj: any = { key: 'test', kind: 'user' };
  // Create a circular reference
  circularObj.self = circularObj;

  const context = Context.fromLDContext(circularObj);
  expect(context.valid).toBeTruthy();
  expect(context.canonicalUnfilteredJson()).toBeUndefined();
});

it('canonicalUnfilteredJson should cache results', () => {
  const context = Context.fromLDContext({
    key: 'test',
    name: 'test name',
  });

  // Setup spy before first call to track if it's called
  // Using require for mocking. Tests are ran in CJS.
  /* eslint-disable @typescript-eslint/no-require-imports */
  /* eslint-disable global-require */
  const canonicalizeModule = require('../src/internal/json/canonicalize');
  const originalCanon = canonicalizeModule.canonicalize;
  const mockCanon = jest.fn().mockImplementation(originalCanon);

  // Replace the canonicalize function
  jest.spyOn(canonicalizeModule, 'canonicalize').mockImplementation(mockCanon);

  try {
    // First call should use the mocked canonicalize
    const result1 = context.canonicalUnfilteredJson();
    expect(result1).toBeDefined();
    expect(mockCanon).toHaveBeenCalledTimes(1);

    // Reset the mock to verify it's not called again
    mockCanon.mockClear();

    // Second call should use cached value and not call canonicalize again
    const result2 = context.canonicalUnfilteredJson();
    expect(result2).toBe(result1);
    expect(mockCanon).not.toHaveBeenCalled();

    // Verify the returned JSON looks valid
    const parsed = JSON.parse(result1!);
    expect(parsed.key).toBe('test');
    expect(parsed.name).toBe('test name');
  } finally {
    // Always restore the original implementation
    jest.spyOn(canonicalizeModule, 'canonicalize').mockImplementation(originalCanon);
  }
});

it('should correctly canonicalize single-kind context', () => {
  const context = Context.fromLDContext({
    key: 'user-key',
    name: 'Test User',
    kind: 'user',
  });

  const jsonResult = context.canonicalUnfilteredJson();
  expect(jsonResult).toBeDefined();

  // Make sure we can parse the result. JSON canonicalization is tested elsewhere.
  const parsed = JSON.parse(jsonResult!);
  expect(parsed.key).toBe('user-key');
  expect(parsed.kind).toBe('user');
  expect(parsed.name).toBe('Test User');
});

it('should correctly canonicalize multi-kind context', () => {
  const context = Context.fromLDContext({
    kind: 'multi',
    user: {
      key: 'user-key',
      name: 'Test User',
    },
    org: {
      key: 'org-key',
      name: 'Test Org',
    },
  });

  const jsonResult = context.canonicalUnfilteredJson();
  expect(jsonResult).toBeDefined();

  // Make sure we can parse the result. JSON canonicalization is tested elsewhere.
  const parsed = JSON.parse(jsonResult!);
  expect(parsed.kind).toBe('multi');
  expect(parsed.org.key).toBe('org-key');
  expect(parsed.user.key).toBe('user-key');
});

it('should handle complex nested objects in canonicalUnfilteredJson', () => {
  const context = Context.fromLDContext({
    key: 'test-key',
    kind: 'user',
    nested: {
      array: [3, 1, 2],
      value: 'test',
    },
  });

  const jsonResult = context.canonicalUnfilteredJson();
  expect(jsonResult).toBeDefined();

  const parsed = JSON.parse(jsonResult!);
  expect(parsed.key).toBe('test-key');
  expect(parsed.kind).toBe('user');
  expect(parsed.nested.array).toEqual([3, 1, 2]);
  expect(parsed.nested.value).toBe('test');
});
