import { Context, internal, TypeValidators } from '@launchdarkly/js-sdk-common';

import {
  LDMigrationConsistencyMeasurement,
  LDMigrationErrorMeasurement,
  LDMigrationEvaluation,
  LDMigrationInvokedMeasurement,
  LDMigrationLatencyMeasurement,
  LDMigrationMeasurement,
  LDMigrationOp,
  LDMigrationOpEvent,
} from './api';

function isOperation(value: LDMigrationOp) {
  if (!TypeValidators.String.is(value)) {
    return false;
  }

  return value === 'read' || value === 'write';
}

function isLatencyMeasurement(
  value: LDMigrationMeasurement,
): value is LDMigrationLatencyMeasurement {
  return value.key === 'latency_ms';
}

function isErrorMeasurement(value: LDMigrationMeasurement): value is LDMigrationErrorMeasurement {
  return value.key === 'error';
}

function isInvokedMeasurement(
  value: LDMigrationMeasurement,
): value is LDMigrationInvokedMeasurement {
  return value.key === 'invoked';
}

function isConsistencyMeasurement(
  value: LDMigrationMeasurement,
): value is LDMigrationConsistencyMeasurement {
  return value.key === 'consistent';
}

function areValidNumbers(values: { old?: number; new?: number }) {
  const oldValue = values.old;
  const newValue = values.new;
  if (oldValue !== undefined && !TypeValidators.Number.is(oldValue)) {
    return false;
  }
  if (newValue !== undefined && !TypeValidators.Number.is(newValue)) {
    return false;
  }
  return true;
}

function areValidBooleans(values: { old?: boolean; new?: boolean }) {
  const oldValue = values.old;
  const newValue = values.new;
  if (oldValue !== undefined && !TypeValidators.Boolean.is(oldValue)) {
    return false;
  }
  if (newValue !== undefined && !TypeValidators.Boolean.is(newValue)) {
    return false;
  }
  return true;
}

function validateMeasurement(
  measurement: LDMigrationMeasurement,
): LDMigrationMeasurement | undefined {
  // Here we are protecting ourselves from JS callers. TypeScript says that
  // it cannot be an empty string, but those using JS can do what they want.
  // @ts-ignore
  if (!TypeValidators.String.is(measurement.key) || measurement.key === '') {
    return undefined;
  }

  if (isLatencyMeasurement(measurement)) {
    if (!TypeValidators.Object.is(measurement.values)) {
      return undefined;
    }
    if (!areValidNumbers(measurement.values)) {
      return undefined;
    }
    return {
      key: measurement.key,
      values: {
        old: measurement.values.old,
        new: measurement.values.new,
      },
    };
  }

  if (isErrorMeasurement(measurement)) {
    if (!TypeValidators.Object.is(measurement.values)) {
      return undefined;
    }
    if (!areValidBooleans(measurement.values)) {
      return undefined;
    }
    return {
      key: measurement.key,
      values: {
        old: measurement.values.old,
        new: measurement.values.new,
      },
    };
  }

  if (isConsistencyMeasurement(measurement)) {
    if (
      !TypeValidators.Boolean.is(measurement.value) ||
      !TypeValidators.Number.is(measurement.samplingRatio)
    ) {
      return undefined;
    }
    return {
      key: measurement.key,
      value: measurement.value,
      samplingRatio: measurement.samplingRatio,
    };
  }

  if (isInvokedMeasurement(measurement)) {
    if (!TypeValidators.Object.is(measurement.values)) {
      return undefined;
    }
    if (!areValidBooleans(measurement.values)) {
      return undefined;
    }
    return {
      key: measurement.key,
      values: {
        old: measurement.values.old,
        new: measurement.values.new,
      },
    };
  }

  // Not a supported measurement type.
  return undefined;
}

function validateMeasurements(measurements: LDMigrationMeasurement[]): LDMigrationMeasurement[] {
  return measurements
    .map(validateMeasurement)
    .filter((value) => value !== undefined) as LDMigrationMeasurement[];
}

function validateEvaluation(evaluation: LDMigrationEvaluation): LDMigrationEvaluation | undefined {
  if (!TypeValidators.String.is(evaluation.key) || evaluation.key === '') {
    return undefined;
  }
  if (!TypeValidators.Object.is(evaluation.reason)) {
    return undefined;
  }
  if (!TypeValidators.String.is(evaluation.reason.kind) || evaluation.reason.kind === '') {
    return undefined;
  }
  const validated: LDMigrationEvaluation = {
    key: evaluation.key,
    value: evaluation.value,
    default: evaluation.default,
    reason: {
      kind: evaluation.reason.kind,
    },
  };

  const inReason = evaluation.reason;
  const outReason = validated.reason;
  if (TypeValidators.String.is(inReason.errorKind)) {
    outReason.errorKind = inReason.errorKind;
  }

  if (TypeValidators.String.is(inReason.ruleId)) {
    outReason.ruleId = inReason.ruleId;
  }

  if (TypeValidators.String.is(inReason.prerequisiteKey)) {
    outReason.prerequisiteKey = inReason.prerequisiteKey;
  }

  if (TypeValidators.Boolean.is(inReason.inExperiment)) {
    outReason.inExperiment = inReason.inExperiment;
  }

  if (TypeValidators.Number.is(inReason.ruleIndex)) {
    outReason.ruleIndex = inReason.ruleIndex;
  }

  if (TypeValidators.String.is(inReason.bigSegmentsStatus)) {
    outReason.bigSegmentsStatus = inReason.bigSegmentsStatus;
  }

  if (evaluation.variation !== undefined && TypeValidators.Number.is(evaluation.variation)) {
    validated.variation = evaluation.variation;
  }

  if (evaluation.version !== undefined && TypeValidators.Number.is(evaluation.version)) {
    validated.version = evaluation.version;
  }

  return validated;
}

/**
 * Migration events can be generated directly in user code and may not follow the shape
 * expected by the TypeScript definitions. So we do some validation on these events, as well
 * as copying the data out of them, to reduce the amount of invalid data we may send.
 *
 * @param inEvent The event to process.
 * @returns An event, or undefined if it could not be converted.
 */
export default function MigrationOpEventToInputEvent(
  inEvent: LDMigrationOpEvent,
): internal.InputMigrationEvent | undefined {
  // The sampling ratio is omitted and needs populated by the track migration method.
  if (inEvent.kind !== 'migration_op') {
    return undefined;
  }

  if (!isOperation(inEvent.operation)) {
    return undefined;
  }

  if (!TypeValidators.Number.is(inEvent.creationDate)) {
    return undefined;
  }

  const contextKeysOrContext: Pick<internal.InputMigrationEvent, 'context' | 'contextKeys'> = {};

  if (TypeValidators.Object.is(inEvent.context)) {
    const context = Context.fromLDContext(inEvent.context);
    if (context.valid) {
      contextKeysOrContext.context = context;
    }
  } else if (TypeValidators.Object.is(inEvent.contextKeys)) {
    if (
      Object.keys(inEvent.contextKeys).every((key) => TypeValidators.Kind.is(key)) &&
      Object.values(inEvent.contextKeys).every(
        (value) => TypeValidators.String.is(value) && value !== '',
      )
    ) {
      contextKeysOrContext.contextKeys = { ...inEvent.contextKeys };
    }
  }

  if (!contextKeysOrContext.context && !contextKeysOrContext.contextKeys) {
    return undefined;
  }

  const samplingRatio = inEvent.samplingRatio ?? 1;

  if (!TypeValidators.Number.is(samplingRatio)) {
    return undefined;
  }

  const evaluation = validateEvaluation(inEvent.evaluation);

  if (!evaluation) {
    return undefined;
  }

  return {
    kind: inEvent.kind,
    operation: inEvent.operation,
    creationDate: inEvent.creationDate,
    ...contextKeysOrContext,
    measurements: validateMeasurements(inEvent.measurements),
    evaluation,
    samplingRatio,
  };
}
