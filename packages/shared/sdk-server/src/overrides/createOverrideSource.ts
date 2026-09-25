import { LDClientContext, TypeValidators } from '@launchdarkly/js-sdk-common';

import { LDOverrideSourceOptions } from '../api/options/LDDataSystemOptions';
import { LDOverrideSource } from '../api/subsystems';

function isOverrideSource(u: unknown): u is LDOverrideSource {
  const candidate = u as Partial<LDOverrideSource> | undefined;
  return (
    TypeValidators.Function.is(candidate?.start) && TypeValidators.Function.is(candidate?.close)
  );
}

/**
 * Creates the override source described by the data system options. A configuration that does
 * not describe a source is an error, reported the way an unsupported data source configuration
 * is reported: by throwing from client construction.
 *
 * @internal
 */
export default function createOverrideSource(
  options: LDOverrideSourceOptions,
  clientContext: LDClientContext,
): LDOverrideSource {
  if (TypeValidators.Function.is(options)) {
    return (options as (clientContext: LDClientContext) => LDOverrideSource)(clientContext);
  }
  if (isOverrideSource(options)) {
    return options;
  }
  throw new Error('Unsupported override source configuration');
}
