// eslint-disable-next-line max-classes-per-file
export enum LDExecutionOrdering {
  Fixed,
  Random,
}

export enum LDExecution {
  Serial,
  Concurrent,
}

export enum LDLatencyTracking {
  Enabled,
  Disabled,
}

export enum LDErrorTracking {
  Enabled,
  Disabled,
}

export type LDMethodResult<TResult> =
  | {
      success: true;
      result: TResult;
    }
  | {
      success: false;
      error: any;
    };

export class LDSerialExecution {
  readonly type: LDExecution = LDExecution.Serial;

  constructor(public readonly ordering: LDExecutionOrdering) {}
}

export class LDConcurrentExecution {
  readonly type: LDExecution = LDExecution.Concurrent;
}

export interface LDMigrationOptions<TMigrationRead, TMigrationWrite> {
  execution?: LDSerialExecution | LDConcurrentExecution;
  latencyTracking?: LDLatencyTracking;
  errorTracking?: LDErrorTracking;
  readNew: () => Promise<LDMethodResult<TMigrationRead>>;
  writeNew: () => Promise<LDMethodResult<TMigrationWrite>>;

  readOld: () => Promise<LDMethodResult<TMigrationRead>>;
  writeOld: () => Promise<LDMethodResult<TMigrationWrite>>;

  check?: (a: TMigrationRead, b: TMigrationRead) => boolean;
}
