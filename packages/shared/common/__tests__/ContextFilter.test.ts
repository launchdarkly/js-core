import { AttributeReference, Context } from '../src';
import ContextFilter from '../src/ContextFilter';

describe('when handling legacy user contexts', () => {
  // users to serialize
  const user = Context.fromLDContext({
    key: 'abc',
    firstName: 'Sue',
    custom: { bizzle: 'def', dizzle: 'ghi' },
  })!;

  const userSpecifyingOwnPrivateAttr = Context.fromLDContext({
    key: 'abc',
    firstName: 'Sue',
    custom: { bizzle: 'def', dizzle: 'ghi' },
    privateAttributeNames: ['dizzle', 'unused'],
  })!;

  const userWithUnknownTopLevelAttrs = Context.fromLDContext({
    key: 'abc',
    firstName: 'Sue',
    species: 'human',
    hatSize: 6,
    custom: { bizzle: 'def', dizzle: 'ghi' },
  })!;

  const anonUser = Context.fromLDContext({
    key: 'abc',
    anonymous: true,
    custom: { bizzle: 'def', dizzle: 'ghi' },
  })!;

  const userWithNonStringsInStringRequiredFields = Context.fromLDContext({
    // @ts-ignore
    key: -1,
    // @ts-ignore
    name: 0,
    ip: 1,
    firstName: 2,
    lastName: ['a', 99, null],
    email: 4,
    avatar: 5,
    country: 6,
    custom: {
      validNumericField: 7,
    },
  })!;

  // expected results from serializing user
  const userWithNothingHidden = {
    bizzle: 'def',
    dizzle: 'ghi',
    firstName: 'Sue',
    key: 'abc',
    kind: 'user',
  };

  const userWithAllAttrsHidden = {
    kind: 'user',
    key: 'abc',
    _meta: {
      redactedAttributes: ['bizzle', 'dizzle', 'firstName'],
    },
  };

  const userWithSomeAttrsHidden = {
    kind: 'user',
    key: 'abc',
    dizzle: 'ghi',
    _meta: {
      redactedAttributes: ['bizzle', 'firstName'],
    },
  };

  const userWithOwnSpecifiedAttrHidden = {
    kind: 'user',
    key: 'abc',
    firstName: 'Sue',
    bizzle: 'def',
    _meta: {
      redactedAttributes: ['dizzle'],
    },
  };

  const anonUserWithAllAttrsHidden = {
    kind: 'user',
    key: 'abc',
    anonymous: true,
    _meta: {
      redactedAttributes: ['bizzle', 'dizzle'],
    },
  };

  const userWithStringFieldsConverted = {
    key: '-1',
    kind: 'user',
    name: '0',
    ip: '1',
    firstName: '2',
    lastName: 'a,99,',
    email: '4',
    avatar: '5',
    country: '6',
    validNumericField: 7,
  };

  const userWithPrivateFieldsWithAPrecedingSlash = Context.fromLDContext({
    key: 'annoying',
    custom: {
      '/why': 'not',
      why: 'because',
    },
    privateAttributeNames: ['/why'],
  })!;

  const userWithPrivateFieldsWithAPrecedingSlashFiltered = {
    kind: 'user',
    key: 'annoying',
    why: 'because',
    _meta: {
      redactedAttributes: ['/~1why'],
    },
  };

  it('includes all user attributes by default', () => {
    const uf = new ContextFilter(false, []);
    expect(uf.filter(user)).toEqual(userWithNothingHidden);
  });

  it('hides all except key if allAttributesPrivate is true', () => {
    const uf = new ContextFilter(true, []);
    expect(uf.filter(user)).toEqual(userWithAllAttrsHidden);
  });

  it('hides some attributes if privateAttributes is set', () => {
    const uf = new ContextFilter(false, [
      new AttributeReference('firstName', true),
      new AttributeReference('bizzle', true),
    ]);
    expect(uf.filter(user)).toEqual(userWithSomeAttrsHidden);
  });

  it('hides attributes specified in per-user redactedAttributes', () => {
    const uf = new ContextFilter(false, []);
    expect(uf.filter(userSpecifyingOwnPrivateAttr)).toEqual(userWithOwnSpecifiedAttrHidden);
  });

  it('looks at both per-user redactedAttributes and global config', () => {
    const uf = new ContextFilter(false, [
      new AttributeReference('firstName', true),
      new AttributeReference('bizzle', true),
    ]);
    expect(uf.filter(userSpecifyingOwnPrivateAttr)).toEqual(userWithAllAttrsHidden);
  });

  it('strips unknown top-level attributes', () => {
    const uf = new ContextFilter(false, []);
    expect(uf.filter(userWithUnknownTopLevelAttrs)).toEqual(userWithNothingHidden);
  });

  it('maintains "anonymous"', () => {
    const uf = new ContextFilter(true, []);
    expect(uf.filter(anonUser)).toEqual(anonUserWithAllAttrsHidden);
  });

  it('converts non-boolean "anonymous" to boolean', () => {
    const uf = new ContextFilter(true, []);
    // @ts-ignore
    expect(uf.filter(Context.fromLDContext({ key: 'user', anonymous: 'yes' }))).toEqual({
      key: 'user',
      kind: 'user',
      anonymous: true,
    });
  });

  it('converts fields to string types when needed', () => {
    const uf = new ContextFilter(false, []);
    expect(uf.filter(userWithNonStringsInStringRequiredFields)).toEqual(
      userWithStringFieldsConverted,
    );
  });

  it('it handles legacy names which had a preceding slash', () => {
    const uf = new ContextFilter(false, []);
    expect(uf.filter(userWithPrivateFieldsWithAPrecedingSlash)).toEqual(
      userWithPrivateFieldsWithAPrecedingSlashFiltered,
    );
  });

  it.each([null, undefined])(
    'handles null and undefined the same for built-in attributes',
    (value) => {
      const cf = new ContextFilter(false, []);
      const nullUndefinedUser = Context.fromLDContext({
        key: 'userKey',
        // @ts-ignore
        name: value,
        ip: value,
        firstName: value,
        lastName: value,
        email: value,
        avatar: value,
        country: value,
      })!;
      expect(cf.filter(nullUndefinedUser)).toEqual({ key: 'userKey', kind: 'user' });
    },
  );
});

describe('when handling single kind contexts', () => {
  // users to serialize
  const context = Context.fromLDContext({
    kind: 'organization',
    key: 'abc',
    firstName: 'Sue',
    bizzle: 'def',
    dizzle: 'ghi',
  })!;

  const contextSpecifyingOwnPrivateAttr = Context.fromLDContext({
    kind: 'organization',
    key: 'abc',
    firstName: 'Sue',
    bizzle: 'def',
    dizzle: 'ghi',
    _meta: {
      privateAttributes: ['dizzle', 'unused'],
    },
  })!;

  const anonymousContext = Context.fromLDContext({
    kind: 'organization',
    key: 'abc',
    anonymous: true,
    bizzle: 'def',
    dizzle: 'ghi',
  })!;

  // expected results from serializing context
  const userWithAllAttrsHidden = {
    kind: 'organization',
    key: 'abc',
    _meta: {
      redactedAttributes: ['bizzle', 'dizzle', 'firstName'],
    },
  };

  const contextWithSomeAttrsHidden = {
    kind: 'organization',
    key: 'abc',
    dizzle: 'ghi',
    _meta: {
      redactedAttributes: ['bizzle', 'firstName'],
    },
  };

  const contextWithOwnSpecifiedAttrHidden = {
    kind: 'organization',
    key: 'abc',
    firstName: 'Sue',
    bizzle: 'def',
    _meta: {
      redactedAttributes: ['dizzle'],
    },
  };

  const contextWithAllAttrsHidden = {
    kind: 'organization',
    key: 'abc',
    anonymous: true,
    _meta: {
      redactedAttributes: ['bizzle', 'dizzle'],
    },
  };

  it('includes all attributes by default', () => {
    const uf = new ContextFilter(false, []);
    expect(uf.filter(context)).toEqual(context.getContexts()[0][1]);
  });

  it('hides all except key if allAttributesPrivate is true', () => {
    const uf = new ContextFilter(true, []);
    expect(uf.filter(context)).toEqual(userWithAllAttrsHidden);
  });

  it('hides some attributes if privateAttributes is set', () => {
    const uf = new ContextFilter(false, [
      new AttributeReference('firstName', true),
      new AttributeReference('bizzle', true),
    ]);
    expect(uf.filter(context)).toEqual(contextWithSomeAttrsHidden);
  });

  it('hides attributes specified in per-context redactedAttributes', () => {
    const uf = new ContextFilter(false, []);
    expect(uf.filter(contextSpecifyingOwnPrivateAttr)).toEqual(contextWithOwnSpecifiedAttrHidden);
  });

  it('looks at both per-context redactedAttributes and global config', () => {
    const uf = new ContextFilter(false, [
      new AttributeReference('firstName', true),
      new AttributeReference('bizzle', true),
    ]);
    expect(uf.filter(contextSpecifyingOwnPrivateAttr)).toEqual(userWithAllAttrsHidden);
  });

  it('context remains anonymous even when all attributes are hidden', () => {
    const uf = new ContextFilter(true, []);
    expect(uf.filter(anonymousContext)).toEqual(contextWithAllAttrsHidden);
  });
});

describe('when handling mult-kind contexts', () => {
  // const contextWithBadContexts = Context.fromLDContext({
  //   kind: 'multi',
  //   string: 'string',
  //   null: null,
  //   number: 0,
  //   real: {
  //     key: 'real',
  //   },
  // } as any)!;

  // const contextWithBadContextsRemoved = {
  //   kind: 'multi',
  //   real: {
  //     key: 'real',
  //   },
  // };

  const orgAndUserContext = Context.fromLDContext({
    kind: 'multi',
    organization: {
      key: 'LD',
      rocks: true,
      name: 'name',
      department: {
        name: 'sdk',
      },
    },
    user: {
      key: 'abc',
      name: 'alphabet',
      letters: ['a', 'b', 'c'],
      order: 3,
      object: {
        a: 'a',
        b: 'b',
      },
      _meta: {
        privateAttributes: ['letters', '/object/b'],
      },
    },
  })!;

  const orgAndUserContextAllPrivate = {
    kind: 'multi',
    organization: {
      key: 'LD',
      _meta: {
        redactedAttributes: ['department', 'name', 'rocks'],
      },
    },
    user: {
      key: 'abc',
      _meta: {
        redactedAttributes: ['letters', 'name', 'object', 'order'],
      },
    },
  };

  const orgAndUserGlobalNamePrivate = {
    kind: 'multi',
    organization: {
      key: 'LD',
      rocks: true,
      department: {
        name: 'sdk',
      },
      _meta: {
        redactedAttributes: ['name'],
      },
    },
    user: {
      key: 'abc',
      order: 3,
      object: {
        a: 'a',
      },
      _meta: {
        redactedAttributes: ['/object/b', 'letters', 'name'],
      },
    },
  };

  const orgAndUserContextIncludedPrivate = {
    kind: 'multi',
    organization: {
      key: 'LD',
      rocks: true,
      name: 'name',
      department: {
        name: 'sdk',
      },
    },
    user: {
      key: 'abc',
      name: 'alphabet',
      order: 3,
      object: {
        a: 'a',
      },
      _meta: {
        redactedAttributes: ['/object/b', 'letters'],
      },
    },
  };

  const multiWithSingleContext = Context.fromLDContext({
    kind: 'multi',
    user: {
      key: 'abc',
      name: 'alphabet',
      letters: ['a', 'b', 'c'],
      order: 3,
      object: {
        a: 'a',
        b: 'b',
      },
      _meta: {
        privateAttributes: ['letters', '/object/b'],
      },
    },
  });

  it('it should remove attributes from all contexts when all attributes are private.', () => {
    const uf = new ContextFilter(true, []);
    expect(uf.filter(orgAndUserContext)).toEqual(orgAndUserContextAllPrivate);
  });

  it('it should apply private attributes from the context to the context.', () => {
    const uf = new ContextFilter(false, []);
    expect(uf.filter(orgAndUserContext)).toEqual(orgAndUserContextIncludedPrivate);
  });

  it('it should apply global private attributes to all contexts.', () => {
    const uf = new ContextFilter(false, [new AttributeReference('name', true)]);
    expect(uf.filter(orgAndUserContext)).toEqual(orgAndUserGlobalNamePrivate);
  });

  it('should produce event with valid single context', () => {
    const uf = new ContextFilter(false, []);
    expect(uf.filter(multiWithSingleContext)).toEqual({
      kind: 'user',
      _meta: {
        redactedAttributes: ['/object/b', 'letters'],
      },
      key: 'abc',
      name: 'alphabet',
      object: {
        a: 'a',
      },
      order: 3,
    });
  });
});
