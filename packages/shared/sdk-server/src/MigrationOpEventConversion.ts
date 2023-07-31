import { internal, TypeValidators } from '@launchdarkly/js-sdk-common';

import { LDMigrationOpEvent } from './api';

export default function MigrationOpEventToInputEvent(
  inEvent: LDMigrationOpEvent,
): internal.InputMigrationEvent | undefined {
  if (inEvent.kind !== 'migration_op') {
    return undefined;
  }
  if (!TypeValidators.Object.is(inEvent.contextKeys)) {
    return undefined;
  }
  if (!TypeValidators.Number.is(inEvent.creationDate)) {
    return undefined;
  }
  if (!Object.keys(inEvent.contextKeys).every((key) => TypeValidators.Kind.is(key))) {
    return undefined;
  }

  if (
    !Object.values(inEvent.contextKeys).every(
      (value) => TypeValidators.String.is(value) && value !== '',
    )
  ) {
    return undefined;
  }

  // TODO: Now much validation do we need on the measurements and output event?

  return {
    ...inEvent,
  };
}
