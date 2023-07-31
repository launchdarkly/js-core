import { TypeValidators, internal } from '@launchdarkly/js-sdk-common';
import { LDMigrationOpEvent } from './api';

export default function MigrationOpEventToInputEvent(
  inEvent: LDMigrationOpEvent
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
  Object.keys(inEvent.contextKeys).every((key) => TypeValidators.Kind.is(key));

  return {
    ...inEvent,
  };
}
