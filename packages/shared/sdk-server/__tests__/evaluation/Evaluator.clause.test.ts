import { AttributeReference, Context, LDContext } from '@launchdarkly/js-sdk-common';

import { Clause } from '../../src/evaluation/data/Clause';
import { Flag } from '../../src/evaluation/data/Flag';
import { FlagRule } from '../../src/evaluation/data/FlagRule';
import Evaluator from '../../src/evaluation/Evaluator';
import { createBasicPlatform } from '../createBasicPlatform';
import {
  makeBooleanFlagWithOneClause,
  makeBooleanFlagWithRules,
  makeClauseThatMatchesUser,
} from './flags';
import noQueries from './mocks/noQueries';

describe('Evaluator.clause', () => {
  let evaluator: Evaluator;
  beforeEach(() => {
    evaluator = new Evaluator(createBasicPlatform(), noQueries);
  });

  // Either a legacy user, or context with equivalent user.
  describe('given user clauses and contexts', () => {
    it.each<LDContext>([
      { key: 'x', name: 'Bob' },
      { kind: 'user', key: 'x', name: 'Bob' },
      { kind: 'multi', user: { key: 'x', name: 'Bob' } },
    ])('can match built-in attribute', async (user) => {
      const clause: Clause = {
        attribute: 'name',
        op: 'in',
        values: ['Bob'],
        attributeReference: new AttributeReference('name'),
      };
      const flag = makeBooleanFlagWithOneClause(clause);
      const context = Context.fromLDContext(user);
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(true);
    });

    it.each<LDContext>([
      { key: 'x', name: 'Bob', custom: { legs: 4 } },
      {
        kind: 'user',
        key: 'x',
        name: 'Bob',
        legs: 4,
      },
      { kind: 'multi', user: { key: 'x', name: 'Bob', legs: 4 } },
    ])('can match custom attribute', async (user) => {
      const clause: Clause = {
        attribute: 'legs',
        op: 'in',
        values: [4],
        attributeReference: new AttributeReference('legs'),
      };
      const flag = makeBooleanFlagWithOneClause(clause);
      const context = Context.fromLDContext(user);
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(true);
    });

    it.each<[LDContext, string]>([
      [{ key: 'x', name: 'Bob', custom: { '//': 4 } }, '//'],
      [
        {
          kind: 'user',
          key: 'x',
          name: 'Bob',
          '//': 4,
        },
        '//',
      ],
      [{ kind: 'multi', user: { key: 'x', name: 'Bob', '//': 4 } }, '//'],
      [{ key: 'x', name: 'Bob', custom: { '/~~': 4 } }, '/~~'],
      [
        {
          kind: 'user',
          key: 'x',
          name: 'Bob',
          '/~~': 4,
        },
        '/~~',
      ],
      [{ kind: 'multi', user: { key: 'x', name: 'Bob', '/~~': 4 } }, '/~~'],
    ])(
      'can match attributes which would have be invalid references, but are valid literals',
      async (user, attribute) => {
        const clause: Clause = {
          attribute,
          op: 'in',
          values: [4],
          attributeReference: new AttributeReference(attribute, true),
        };
        const flag = makeBooleanFlagWithOneClause(clause);
        const context = Context.fromLDContext(user);
        const res = await evaluator.evaluate(flag, context!);
        expect(res.detail.value).toBe(true);
      },
    );

    it.each<LDContext>([
      { key: 'x', name: 'Bob' },
      { kind: 'user', key: 'x', name: 'Bob' },
      { kind: 'multi', user: { key: 'x', name: 'Bob' } },
    ])('does not match missing attribute', async (user) => {
      const clause: Clause = {
        attribute: 'legs',
        op: 'in',
        values: [4],
        attributeReference: new AttributeReference('legs'),
      };
      const flag = makeBooleanFlagWithOneClause(clause);
      const context = Context.fromLDContext(user);
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(false);
    });

    it.each<LDContext>([
      { key: 'x', name: 'Bob' },
      { kind: 'user', key: 'x', name: 'Bob' },
      { kind: 'multi', user: { key: 'x', name: 'Bob' } },
    ])('can have a negated clause', async (user) => {
      const clause: Clause = {
        attribute: 'name',
        op: 'in',
        values: ['Bob'],
        negate: true,
        attributeReference: new AttributeReference('name'),
      };
      const flag = makeBooleanFlagWithOneClause(clause);
      const context = Context.fromLDContext(user);
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(false);
    });

    // An equivalent test existed in the previous suite. I see no reason that the
    // current code could encounter such a situation, but this will help ensure
    // it never does.
    it('does not overflow the call stack when evaluating a huge number of clauses', async () => {
      const user = { key: 'user' };
      const clauseCount = 5000;
      const flag: Flag = {
        key: 'flag',
        targets: [],
        on: true,
        variations: [false, true],
        fallthrough: { variation: 0 },
        version: 1,
      };
      // Note, for this test to be meaningful, the clauses must all match the user, since we
      // stop evaluating clauses on the first non-match.
      const clause = makeClauseThatMatchesUser(user);
      const clauses = [];
      for (let i = 0; i < clauseCount; i += 1) {
        clauses.push(clause);
      }
      const rule: FlagRule = { id: '1234', clauses, variation: 1 };
      flag.rules = [rule];
      const context = Context.fromLDContext(user);
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(true);
    });

    it('matches kind of implicit user', async () => {
      const user = { key: 'x', name: 'Bob' };
      const clause: Clause = {
        attribute: 'kind',
        op: 'in',
        values: ['user'],
        attributeReference: new AttributeReference('kind'),
      };
      const flag = makeBooleanFlagWithOneClause(clause);
      const context = Context.fromLDContext(user);
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(true);
    });

    it('implicit user kind does not match rules for non-user kinds', async () => {
      const user = { key: 'x', name: 'Bob' };
      const clause: Clause = {
        attribute: 'key',
        op: 'in',
        values: ['userkey'],
        contextKind: 'org',
        attributeReference: new AttributeReference('key'),
      };
      const flag = makeBooleanFlagWithOneClause(clause);
      const context = Context.fromLDContext(user);
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(false);
    });
  });

  describe('given non-user single-kind contexts', () => {
    it('does not match implicit user clauses to non-user contexts', async () => {
      const clause: Clause = {
        attribute: 'name',
        op: 'in',
        values: ['Bob'],
        attributeReference: new AttributeReference('name'),
      };
      const flag = makeBooleanFlagWithOneClause(clause);
      const context = Context.fromLDContext({ kind: 'org', name: 'Bob', key: 'bobkey' });
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(false);
    });

    it('cannot use an object attribute for a match.', async () => {
      const clause: Clause = {
        attribute: 'complex',
        op: 'in',
        values: [{ thing: true }],
        contextKind: 'org',
        attributeReference: new AttributeReference('complex'),
      };
      const flag = makeBooleanFlagWithOneClause(clause);
      const context = Context.fromLDContext({
        kind: 'org',
        name: 'Bob',
        key: 'bobkey',
        complex: { thing: true },
      });
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(false);
    });

    it('does match clauses for the correct context kind', async () => {
      const clause: Clause = {
        attribute: 'name',
        op: 'in',
        values: ['Bob'],
        contextKind: 'org',
        attributeReference: new AttributeReference('name'),
      };
      const flag = makeBooleanFlagWithOneClause(clause);
      const context = Context.fromLDContext({ kind: 'org', name: 'Bob', key: 'bobkey' });
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(true);
    });

    it('matches clauses for the kind attribute', async () => {
      // The context kind here should not matter, but the 'kind' attribute should.
      const clause: Clause = {
        attribute: 'kind',
        op: 'in',
        values: ['org'],
        contextKind: 'potato',
        attributeReference: new AttributeReference('kind'),
      };
      const flag = makeBooleanFlagWithOneClause(clause);
      const context = Context.fromLDContext({ kind: 'org', name: 'Bob', key: 'bobkey' });
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(true);
    });

    it('does not match clauses for the kind attribute if the kind does not match', async () => {
      // The context kind here should not matter, but the 'kind' attribute should.
      const clause: Clause = {
        attribute: 'kind',
        op: 'in',
        values: ['org'],
        contextKind: 'potato',
        attributeReference: new AttributeReference('kind'),
      };
      const flag = makeBooleanFlagWithOneClause(clause);
      const context = Context.fromLDContext({ kind: 'party', name: 'Bob', key: 'bobkey' });
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(false);
    });
  });

  describe('given multi-kind contexts', () => {
    it('does match clauses correctly with multiple contexts', async () => {
      const clause1: Clause = {
        attribute: 'region',
        op: 'in',
        values: ['north'],
        contextKind: 'park',
        attributeReference: new AttributeReference('region'),
      };
      const clause2: Clause = {
        attribute: 'count',
        op: 'in',
        values: [5],
        contextKind: 'party',
        attributeReference: new AttributeReference('count'),
      };

      const context = Context.fromLDContext({
        kind: 'multi',
        park: {
          key: 'park',
          region: 'north',
        },
        party: {
          key: 'party',
          count: 5,
        },
      });

      const flag = makeBooleanFlagWithRules([
        { id: '1234', clauses: [clause1, clause2], variation: 1 },
      ]);
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(true);
    });

    it('does not match the values from the wrong contexts', async () => {
      const clause1: Clause = {
        attribute: 'region',
        op: 'in',
        values: ['north'],
        contextKind: 'park',
        attributeReference: new AttributeReference('region'),
      };
      const clause2: Clause = {
        attribute: 'count',
        op: 'in',
        values: [5],
        contextKind: 'party',
        attributeReference: new AttributeReference('count'),
      };

      const context = Context.fromLDContext({
        kind: 'multi',
        park: {
          key: 'park',
          count: 5,
        },
        party: {
          key: 'party',
          region: 'north',
        },
      });

      const flag = makeBooleanFlagWithRules([
        { id: '1234', clauses: [clause1, clause2], variation: 1 },
      ]);
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(false);
    });

    it('can check for the presence of contexts', async () => {
      const clause: Clause = {
        attribute: 'kind',
        op: 'in',
        values: ['party'],
        attributeReference: new AttributeReference('kind'),
      };

      const context = Context.fromLDContext({
        kind: 'multi',
        park: {
          key: 'park',
          count: 5,
        },
        party: {
          key: 'party',
          region: 'north',
        },
      });

      const flag = makeBooleanFlagWithOneClause(clause);
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(true);
    });

    it('does not match if the kind is not in the context', async () => {
      const clause: Clause = {
        attribute: 'kind',
        op: 'in',
        values: ['zoo'],
        attributeReference: new AttributeReference('kind'),
      };

      const context = Context.fromLDContext({
        kind: 'multi',
        park: {
          key: 'park',
          count: 5,
        },
        party: {
          key: 'party',
          region: 'north',
        },
      });

      const flag = makeBooleanFlagWithOneClause(clause);
      const res = await evaluator.evaluate(flag, context!);
      expect(res.detail.value).toBe(false);
    });
  });

  it('handles clauses with malformed attribute references', async () => {
    const clause: Clause = {
      attribute: '//region',
      op: 'in',
      values: ['north'],
      contextKind: 'park',
      attributeReference: new AttributeReference('//region'),
    };

    const context = Context.fromLDContext({
      kind: 'multi',
      park: {
        key: 'park',
        region: 'north',
      },
      party: {
        key: 'party',
        count: 5,
      },
    });

    const flag = makeBooleanFlagWithRules([{ id: '1234', clauses: [clause], variation: 1 }]);
    const res = await evaluator.evaluate(flag, context!);
    expect(res.detail.reason).toEqual({ kind: 'ERROR', errorKind: 'MALFORMED_FLAG' });
    expect(res.detail.value).toBe(null);
  });

  describe.each([
    ['lessThan', 99, 99.0001],
    ['lessThanOrEqual', 99, 99.0001],
    ['greaterThan', 99.0001, 99],
    ['greaterThanOrEqual', 99.0001, 99],

    // string comparisons
    ['startsWith', 'xyz', 'x'],
    ['endsWith', 'xyz', 'z'],
    ['contains', 'xyz', 'y'],

    // regex
    ['matches', 'hello world', 'hello.*rld'],

    // dates
    ['before', 0, 1],
    ['after', '1970-01-01T00:00:02.500Z', 1000],

    // semver
    ['semVerLessThan', '2.0.0', '2.0.1'],
    ['semVerGreaterThan', '2.0.1', '2.0.0'],
  ])(
    'executes operations with the clause value and context value correctly',
    (operator, contextValue, clauseValue) => {
      const clause: Clause = {
        attribute: 'value',
        // @ts-ignore
        op: operator,
        values: [clauseValue],
        contextKind: 'potato',
        attributeReference: new AttributeReference('value'),
      };

      const context = Context.fromLDContext({
        kind: 'potato',
        key: 'potato',
        value: contextValue,
      });

      const contextWArray = Context.fromLDContext({
        kind: 'potato',
        key: 'potato',
        value: [contextValue],
      });

      it(`Operator ${operator} with ${contextValue} and ${clauseValue} should be true`, async () => {
        const flag = makeBooleanFlagWithOneClause(clause);
        const res = await evaluator.evaluate(flag, context);
        expect(res.detail.value).toBe(true);

        const res2 = await evaluator.evaluate(flag, contextWArray);
        expect(res2.detail.value).toBe(true);
      });
    },
  );
});
