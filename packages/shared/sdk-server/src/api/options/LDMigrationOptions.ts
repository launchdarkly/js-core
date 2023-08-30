/* eslint-disable max-classes-per-file */
// Disabling max classes per file as these are tag classes without
// logic implementation.

/**
 * When execution is sequential this enum is used to control if execution
 * should be in a fixed or random order.
 */
export enum LDExecutionOrdering {
  Fixed,
  Random,
}

/**
 * Tag used to determine if execution should be serial or concurrent.
 * Callers should not need to use this directly.
 */
export enum LDExecution {
  /**
   * Execution will be serial. One read method will be executed fully before
   * the other read method.
   */
  Serial,
  /**
   * Execution will be concurrent. The execution of the read methods will be
   * started and then resolved concurrently.
   */
  Concurrent,
}

/**
 * Migration methods may return an LDMethodResult.
 * The implementation includes methods for creating results conveniently.
 *
 * An implementation may also throw an exception to represent an error.
 */
export type LDMethodResult<TResult> =
  | {
      success: true;
      result: TResult;
    }
  | {
      success: false;
      error: any;
    };

/**
 * Configuration class for configuring serial execution of a migration.
 */
export class LDSerialExecution {
  readonly type: LDExecution = LDExecution.Serial;

  constructor(public readonly ordering: LDExecutionOrdering) {}
}

/**
 * Configuration class for configuring concurrent execution of a migration.
 */
export class LDConcurrentExecution {
  readonly type: LDExecution = LDExecution.Concurrent;
}

/**
 * Configuration for a migration.
 */
export interface LDMigrationOptions<
  TMigrationRead,
  TMigrationWrite,
  TMigrationReadInput,
  TMigrationWriteInput,
> {
  /**
   * Configure how the migration should execute. If omitted the execution will
   * be concurrent.
   */
  execution?: LDSerialExecution | LDConcurrentExecution;

  /**
   * Configure the latency tracking for the migration.
   *
   * Defaults to {@link true}.
   */
  latencyTracking?: boolean;

  /**
   * Configure the error tracking for the migration.
   *
   * Defaults to {@link true}.
   */
  errorTracking?: boolean;

  /**
   * Implementation which provides a read from the "new" source.
   *
   * Users are required to provide two different read methods -- one to read from the old migration source, and one to
   * read from the new source. Additionally, customers can opt-in to consistency tracking by providing a comparison
   * function.
   *
   * Depending on the migration stage, one or both of these read methods may be called.
   *
   * @param payload An optional payload. The payload is provided when calling the  `read` method on the migration.
   * @returns The result of the operation. Use {@link LDMigrationSuccess} or {@link LDMigrationFailure} to create a suitable return value.
   */
  readNew: (payload?: TMigrationReadInput) => Promise<LDMethodResult<TMigrationRead>>;

  /**
   * Implementation which provides a write to the "new" source.
   *
   * Users are required to provide two different write methods -- one to write to the old migration source, and one to
   * write to the new source. Not every stage requires
   *
   * Depending on the migration stage, one or both of these write methods may be called.
   * @param payload An optional payload. The payload is provided when calling the  `read` method on the migration.
   * @returns The result of the operation. Use {@link LDMigrationSuccess} or {@link LDMigrationFailure} to create a suitable return value.
   */
  writeNew: (payload?: TMigrationWriteInput) => Promise<LDMethodResult<TMigrationWrite>>;

  /**
   * Implementation which provides a read from the "old" source.
   *
   * Users are required to provide two different read methods -- one to read from the old migration source, and one to
   * read from the new source. Additionally, customers can opt-in to consistency tracking by providing a comparison
   * function.
   *
   * Depending on the migration stage, one or both of these read methods may be called.
   */
  readOld: (payload?: TMigrationReadInput) => Promise<LDMethodResult<TMigrationRead>>;

  /**
   * Implementation which provides a write to the "old" source.
   *
   * Users are required to provide two different write methods -- one to write to the old migration source, and one to
   * write to the new source. Not every stage requires
   *
   * Depending on the migration stage, one or both of these write methods may be called.
   * @param payload An optional payload. The payload is provided when calling the  `read` method on the migration.
   * @returns The result of the operation. Use {@link LDMigrationSuccess} or {@link LDMigrationFailure} to create a suitable return value.
   */
  writeOld: (payload?: TMigrationWriteInput) => Promise<LDMethodResult<TMigrationWrite>>;

  /**
   * Method used to do consistency checks for read operations. After a read operation, during which both data sources
   * are read from, a check of read consistency may be done using this method.
   */
  check?: (a: TMigrationRead, b: TMigrationRead) => boolean;
}
