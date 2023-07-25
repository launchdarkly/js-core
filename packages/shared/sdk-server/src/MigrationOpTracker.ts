import { LDEvaluationReason } from '@launchdarkly/js-sdk-common';
import { LDMigrationStage } from './api';
import { LDMigrationOp } from './api/data/LDMigrationOpEvent';

interface LDMigrationDetail {
  value: LDMigrationStage,
  variationIndex?: number | null,
  reason: LDEvaluationReason
}

class MigrationOpTracker {
  constructor(private readonly op: LDMigrationOp) {}

  stage(stage:LDMigrationDetail) {}

  /**
   * Report that an error happened in either the 'new' or 'old' implementation.
   *
   * This just tracks errors that occur, not the details of the errors.
   */
  error(origin: 'old' | 'new'){

  }

  /**
   * Report that a consistency error occurred.
   */
  consistencyError() {

  }

  /**
   * Report the latency for an implementation.
   *
   * @param origin If the latency is for the 'old' or 'new' implementation.
   * @param value The latency of the operation in milliseconds (TODO is it MS?).
   */
  latency(origin: 'old' | 'new', value: number) {}
}