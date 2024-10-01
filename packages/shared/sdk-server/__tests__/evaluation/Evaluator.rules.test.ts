// Tests of flag evaluation at the rule level. Clause-level behavior is covered
// in detail in Evaluator.clause.tests and (TODO: File for segments).
import { AttributeReference, Context, LDContext } from '@launchdarkly/js-sdk-common';

import { Clause } from '../../src/evaluation/data/Clause';
import { Flag } from '../../src/evaluation/data/Flag';
import { FlagRule } from '../../src/evaluation/data/FlagRule';
import Evaluator from '../../src/evaluation/Evaluator';
import { createBasicPlatform } from '../createBasicPlatform';
import {
  makeClauseThatDoesNotMatchUser,
  makeClauseThatMatchesUser,
  makeFlagWithRules,
} from './flags';
import noQueries from './mocks/noQueries';

const basicUser: LDContext = { key: 'userkey' };
const basicSingleKindUser: LDContext = { kind: 'user', key: 'userkey' };
const basicMultiKindUser: LDContext = { kind: 'multi', user: { key: 'userkey' } };

describe('Evaluator.rules', () => {
  let evaluator: Evaluator;
  beforeEach(() => {
    evaluator = new Evaluator(createBasicPlatform(), noQueries);
  });

  describe('when evaluating user equivalent contexts', () => {
    const matchClause = makeClauseThatMatchesUser(basicUser);
    const noMatchClause = makeClauseThatDoesNotMatchUser(basicUser);

    it.each<LDContext>([basicUser, basicSingleKindUser, basicMultiKindUser])(
      'matches user from rules',
      async (userToTest) => {
        const rule0: FlagRule = {
          id: 'id0',
          clauses: [noMatchClause],
          variation: 1,
        };
        const rule1: FlagRule = {
          id: 'id1',
          clauses: [matchClause],
          variation: 2,
        };
        const flag = makeFlagWithRules([rule0, rule1]);
        const res = await evaluator.evaluate(flag, Context.fromLDContext(userToTest));
        expect(res.detail).toMatchObject({
          value: 'c',
          variationIndex: 2,
          reason: { kind: 'RULE_MATCH', ruleIndex: 1, ruleId: 'id1' },
        });
      },
    );

    it.each<LDContext>([basicUser, basicSingleKindUser, basicMultiKindUser])(
      'returns error if rule variation is too high',
      async (userToTest) => {
        const rule: FlagRule = { id: 'id', clauses: [matchClause], variation: 99 };
        const flag = makeFlagWithRules([rule]);
        const res = await evaluator.evaluate(flag, Context.fromLDContext(userToTest));
        expect(res.isError).toBeTruthy();
        expect(res.message).toEqual('Invalid variation index in flag');
        expect(res.detail).toMatchObject({
          value: null,
          variationIndex: null,
          reason: { kind: 'ERROR', errorKind: 'MALFORMED_FLAG' },
        });
      },
    );

    it.each<LDContext>([basicUser, basicSingleKindUser, basicMultiKindUser])(
      'returns error if rule variation is negative',
      async (userToTest) => {
        const rule: FlagRule = { id: 'id', clauses: [matchClause], variation: -1 };
        const flag = makeFlagWithRules([rule]);
        const res = await evaluator.evaluate(flag, Context.fromLDContext(userToTest));
        expect(res.isError).toBeTruthy();
        expect(res.message).toEqual('Invalid variation index in flag');
        expect(res.detail).toMatchObject({
          value: null,
          variationIndex: null,
          reason: { kind: 'ERROR', errorKind: 'MALFORMED_FLAG' },
        });
      },
    );

    it.each<LDContext>([basicUser, basicSingleKindUser, basicMultiKindUser])(
      'returns error if rule has no variation or rollout',
      async (userToTest) => {
        const rule: FlagRule = { id: 'id', clauses: [matchClause] };
        const flag = makeFlagWithRules([rule]);
        const res = await evaluator.evaluate(flag, Context.fromLDContext(userToTest));
        expect(res.isError).toBeTruthy();
        expect(res.message).toEqual('Variation/rollout object with no variation or rollout');
        expect(res.detail).toMatchObject({
          value: null,
          variationIndex: null,
          reason: { kind: 'ERROR', errorKind: 'MALFORMED_FLAG' },
        });
      },
    );

    it.each<LDContext>([basicUser, basicSingleKindUser, basicMultiKindUser])(
      'returns error if rule has rollout with no variations',
      async (userToTest) => {
        const rule: FlagRule = { id: 'id', clauses: [matchClause], rollout: { variations: [] } };
        const flag = makeFlagWithRules([rule]);
        const res = await evaluator.evaluate(flag, Context.fromLDContext(userToTest));
        expect(res.isError).toBeTruthy();
        expect(res.message).toEqual('Variation/rollout object with no variation or rollout');
        expect(res.detail).toMatchObject({
          value: null,
          variationIndex: null,
          reason: { kind: 'ERROR', errorKind: 'MALFORMED_FLAG' },
        });
      },
    );

    it.each<LDContext>([basicUser, basicSingleKindUser, basicMultiKindUser])(
      'does not overflow the call stack when evaluating a huge number of rules',
      async (userToTest) => {
        const ruleCount = 5000;
        const flag: Flag = {
          key: 'flag',
          targets: [],
          on: true,
          variations: [false, true],
          fallthrough: { variation: 0 },
          version: 1,
        };
        // Note, for this test to be meaningful, the rules must *not* match the user, since we
        // stop evaluating rules on the first match.
        const rules: FlagRule[] = [];
        for (let i = 0; i < ruleCount; i += 1) {
          rules.push({ id: '1234', clauses: [noMatchClause], variation: 1 });
        }
        flag.rules = rules;
        const res = await evaluator.evaluate(flag, Context.fromLDContext(userToTest));
        expect(res.isError).toBeFalsy();
        expect(res.detail.value).toEqual(false);
      },
    );
  });

  describe('when evaluating non-user contexts', () => {
    const targetKey = 'targetKey';
    const targetContextKind = 'org';
    const matchClause: Clause = {
      attribute: 'key',
      op: 'in',
      values: [targetKey],
      contextKind: targetContextKind,
      attributeReference: new AttributeReference('key'),
    };
    const noMatchClause: Clause = {
      attribute: 'key',
      op: 'in',
      values: [`not-${targetKey}`],
      contextKind: targetContextKind,
      attributeReference: new AttributeReference('key'),
    };

    const singleKindContext: LDContext = {
      kind: targetContextKind,
      key: targetKey,
    };
    const multiKindContext: LDContext = {
      kind: 'multi',
    };
    multiKindContext[targetContextKind] = {
      key: targetKey,
    };

    it.each([singleKindContext, multiKindContext])(
      'matches user from rules',
      async (contextToTest) => {
        const rule0: FlagRule = { id: 'id0', clauses: [noMatchClause], variation: 1 };
        const rule1: FlagRule = { id: 'id1', clauses: [matchClause], variation: 2 };
        const flag = makeFlagWithRules([rule0, rule1]);
        const res = await evaluator.evaluate(flag, Context.fromLDContext(contextToTest));
        expect(res.detail).toMatchObject({
          value: 'c',
          variationIndex: 2,
          reason: { kind: 'RULE_MATCH', ruleIndex: 1, ruleId: 'id1' },
        });
      },
    );
  });
});
