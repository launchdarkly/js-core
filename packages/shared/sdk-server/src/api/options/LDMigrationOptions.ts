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

export class LDSerialExecution {
  readonly type: LDExecution = LDExecution.Serial;

  constructor(public readonly ordering: LDExecutionOrdering) { }
}

export class LDConcurrentExecution {
  readonly type: LDExecution = LDExecution.Concurrent;
}

export interface LDMigrationOptions<TMigration> {
  execution?: LDSerialExecution | LDConcurrentExecution;
  latencyTracking?: LDLatencyTracking;
  errorTracking?: LDErrorTracking;
  readNew: () => Promise<TMigration>;
  writeNew: () => Promise<TMigration>;

  readOld: () => Promise<TMigration>;
  writeOld: () => Promise<TMigration>;

  check?: (a: TMigration, b: TMigration) => boolean;
}

export type LDReadonlyMigrationOptions<TMigration> = Omit<
  LDMigrationOptions<TMigration>,
  'writeNew' | 'writeOld'
>;
