/**
 * Internal use only. These functions should only be used as part of the initial validation of
 * the LDContext object. Thereafter, the Context object should be used.
 */
import type { LDContext, LDMultiKindContext, LDSingleKindContext, LDUser } from '../../api';
import { TypeValidators } from '../../validators';

/**
 * Check if a context is a single kind context.
 * @param context
 * @returns true if the context is a single kind context.
 */
export function isSingleKind(context: LDContext): context is LDSingleKindContext {
  if ('kind' in context) {
    return TypeValidators.String.is(context.kind) && context.kind !== 'multi';
  }
  return false;
}

/**
 * Check if a context is a multi-kind context.
 * @param context
 * @returns true if it is a multi-kind context.
 */
export function isMultiKind(context: LDContext): context is LDMultiKindContext {
  if ('kind' in context) {
    return TypeValidators.String.is(context.kind) && context.kind === 'multi';
  }
  return false;
}

/**
 * Check if a context is a legacy user context.
 * @param context
 * @returns true if it is a legacy user context.
 */
export function isLegacyUser(context: LDContext): context is LDUser {
  return !('kind' in context) || context.kind === null || context.kind === undefined;
}
