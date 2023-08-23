// Migration events are not currently supported by client-side SDKs, so this
// shared implementation contains minimal typing. If/When migration events are
// to be supported by client-side SDKs the appropriate types would be moved
// to the common implementation.

export default interface InputMigrationEvent {
  kind: 'migration_op';
  operation: string;
  creationDate: number;
  contextKeys: Record<string, string>;
  evaluation: any;
  measurements: any[];
  samplingRatio: number;
}
