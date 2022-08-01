import { AttributeReference, LDContext } from '@launchdarkly/js-sdk-common';
import { Clause } from '../../src/evaluation/data/Clause';
import { Flag } from '../../src/evaluation/data/Flag';
import { FlagRule } from '../../src/evaluation/data/FlagRule';
import { Segment } from '../../src/evaluation/data/Segment';
import { VariationOrRollout } from '../../src/evaluation/data/VariationOrRollout';

export function makeFlagWithRules(rules: FlagRule[], fallthrough?: VariationOrRollout): Flag {
  return {
    key: 'feature',
    on: true,
    rules,
    targets: [],
    fallthrough: fallthrough || { variation: 0 },
    offVariation: 1,
    variations: ['a', 'b', 'c'],
    version: 1,
  };
}

export function makeBooleanFlagWithRules(rules: FlagRule[]) {
  return {
    on: true,
    fallthrough: { variation: 0 },
    variations: [false, true],
    key: 'feature',
    version: 1,
    rules,
    salt: '',
  };
}

export function makeBooleanFlagWithOneClause(clause: Clause) {
  return makeBooleanFlagWithRules([{
    id: '1234',
    clauses: [clause],
    variation: 1,
  }]);
}

export function makeClauseThatMatchesUser(user: LDContext): Clause {
  return {
    attribute: 'key',
    op: 'in',
    values: [user.key],
    attributeReference: new AttributeReference('key'),
  };
}

export function makeClauseThatDoesNotMatchUser(user: LDContext): Clause {
  return {
    attribute: 'key',
    op: 'in',
    values: [`not-${user.key}`],
    attributeReference: new AttributeReference('key'),
  };
}

export function makeSegmentMatchClause(segment: Segment): Clause {
  return {
    attribute: '',
    attributeReference: new AttributeReference(''),
    op: 'segmentMatch',
    values: [segment.key],
  };
}

export function makeFlagWithSegmentMatch(segment: Segment) {
  return makeBooleanFlagWithOneClause(makeSegmentMatchClause(segment));
}
