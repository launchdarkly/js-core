import AttributeReference from '../src/AttributeReference';
import Context from '../src/Context';

// A sample of invalid characters.
const invalidSampleChars = [...`#$%&'()*+,/:;<=>?@[\\]^\`{|}~ ¡¢£¤¥¦§¨©ª«¬­®¯°±²
³´µ¶·¸¹º»¼½¾¿À汉字`];
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
])('given invalid LDContext', (ldConext) => {
  it(`should not create a context ${JSON.stringify(ldConext)}`, () => {
    // Force TS to accept our bad contexts.
    // @ts-ignore
    expect(Context.fromLDContext(ldConext).valid).toBeFalsy();
  });
});

describe.each([
  {
    key: 'test',
    name: 'context name',
    custom: { cat: 'calico', '/dog~~//': 'lab' },
    anonymous: true,
    secondary: 'secondary',
    privateAttributeNames: ['/dog~~//'],
  },
  {
    kind: 'user',
    key: 'test',
    name: 'context name',
    cat: 'calico',
    anonymous: true,
    _meta: { secondary: 'secondary', privateAttributes: ['/~1dog~0~0~1~1'] },
  },
  {
    kind: 'multi',
    user: {
      key: 'test',
      cat: 'calico',
      anonymous: true,
      name: 'context name',
      _meta: { secondary: 'secondary', privateAttributes: ['/~1dog~0~0~1~1'] },
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
    expect(context?.secondary('user')).toEqual('secondary');
    expect(context?.isMultiKind).toBeFalsy();
    expect(context?.privateAttributes('user')?.[0].redactionName)
      .toEqual(new AttributeReference('/~1dog~0~0~1~1').redactionName);
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
    secondary: 'secondary',
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
    expect(context?.secondary('user')).toEqual('secondary');
    expect(context?.isMultiKind).toBeFalsy();
    expect(context?.privateAttributes('user')?.[0].redactionName)
      .toEqual(new AttributeReference('/~1dog~0~0~1~1').redactionName);
  });
});

describe('given a non-user single kind context', () => {
  const context = Context.fromLDContext({
    kind: 'org',
    // Key will be URL encoded.
    key: 'Org/Key',
    value: 'OrgValue',
  });
  it('should have the correct canonical key', () => {
    expect(context?.canonicalKey).toEqual('org:Org%2FKey');
  });

  it('secondary should not be defined when not present', () => {
    expect(context?.secondary('org')).toBeUndefined();
  });

  it('should have the correct kinds', () => {
    expect(context?.kinds).toEqual(['org']);
  });

  it('should have the correct kinds and keys', () => {
    expect(context?.kindsAndKeys).toEqual({ org: 'Org/Key' });
  });
});

it('secondary should be defined when present', () => {
  const context = Context.fromLDContext({
    kind: 'org',
    // Key will be URL encoded.
    key: 'Org/Key',
    value: 'OrgValue',
    _meta: { secondary: 'secondary' },
  });
  expect(context?.secondary('org')).toEqual('secondary');
});

it('secondary should be undefined when meta is present, but secondary is not', () => {
  const context = Context.fromLDContext({
    kind: 'org',
    // Key will be URL encoded.
    key: 'Org/Key',
    value: 'OrgValue',
    _meta: {},
  });
  expect(context?.secondary('org')).toBeUndefined();
});

it('secondary key should be undefined when not a string', () => {
  const context = Context.fromLDContext({
    // @ts-ignore
    kind: 'org',
    // Key will be URL encoded.
    key: 'Org/Key',
    // @ts-ignore
    value: 'OrgValue',
    // @ts-ignore
    _meta: { secondary: 17 }, // This really displeases typescript.
  });
  expect(context?.secondary('org')).toBeUndefined();
});

describe('given a multi-kind context', () => {
  const context = Context.fromLDContext({
    kind: 'multi',

    user: {
      key: 'User /Key',
      // Key will be URL encoded.
      value: 'UserValue',
    },
    org: {
      key: 'OrgKey',
      value: 'OrgValue',
      _meta: {
        secondary: 'value',
      },
    },
  });

  it('should have the correct canonical key', () => {
    expect(context?.canonicalKey).toEqual('org:OrgKey:user:User%20%2FKey');
  });

  it('should get values from the correct context', () => {
    expect(context?.valueForKind(new AttributeReference('value'), 'org')).toEqual('OrgValue');
    expect(context?.valueForKind(new AttributeReference('value'), 'user')).toEqual('UserValue');

    expect(context?.secondary('org')).toEqual('value');
    expect(context?.secondary('user')).toBeUndefined();
  });

  it('should have the correct kinds', () => {
    expect(context?.kinds.sort()).toEqual(['org', 'user']);
  });

  it('should have the correct kinds and keys', () => {
    expect(context?.kindsAndKeys).toEqual({ org: 'OrgKey', user: 'User /Key' });
  });
});
