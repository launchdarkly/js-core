import { Data, HealthStatus } from './DataSource';

/**
 * Will make best effort to retrieve all data.  Error indicates it was unable to.
 */
export interface DataSystemInitializer {
  run(
    dataCallback: (basis: boolean, data: Data) => void,
    statusCallback: (status: HealthStatus, durationMS: number) => void,
    errorHander: (err: any) => void,
  ): void;
}

export interface InitializerFactory {
  create(): DataSystemInitializer;
}
