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

export interface LDMigration<TMigration> {
  execution: LDSerialExecution | LDConcurrentExecution;
  latencyTracking: LDLatencyTracking;
  errorTracking: LDErrorTracking;
  readNew: () => TMigration;
  writeNew: () => TMigration;

  readOld: () => TMigration;
  writeOld: () => TMigration;

  check?: (a: TMigration, b: TMigration) => boolean;
}

export type LDReadonlyMigration<TMigration> = Omit<
  LDMigration<TMigration>,
  'writeNew' | 'writeOld'
>;
