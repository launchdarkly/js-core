import { Context } from '@launchdarkly/js-sdk-common';
import Operators from './Operations';
import { Clause } from './data/Clause';

function maybeNegate(clause: Clause, value: boolean): boolean {
  if (clause.negate) {
    return !value;
  }
  return value;
}

function matchAny(op: string, value: any, values: any[]) {
  return values.some((testValue) => Operators.execute(op, value, testValue));
}

/**
 * Match a clause against a context.
 * @param clause The clause to match against a context.
 * @param context The context to match.
 * @returns True if the clause matches.
 *
 * @internal
 */
export default function matchClauseWithoutSegmentOperations(
  clause: Clause,
  context: Context
): boolean {
  const contextValue = context.valueForKind(clause.attributeReference, clause.contextKind);
  if (contextValue === null || contextValue === undefined) {
    return false;
  }
  if (Array.isArray(contextValue)) {
    return maybeNegate(
      clause,
      contextValue.some((value) => matchAny(clause.op, value, clause.values))
    );
  }
  return maybeNegate(clause, matchAny(clause.op, contextValue, clause.values));
}
