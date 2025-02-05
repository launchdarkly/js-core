import { Data, HealthStatus } from './DataSource';

/**
 * Will make best effort to retrieve all data.  Error indicates it was unable to.
 */
export interface DataSystemSynchronizer {
  run(
    dataCallback: (basis: boolean, data: Data) => void,
    statusCallback: (status: HealthStatus, durationMS: number) => void,
    errorHander: (err: any) => void,
  ): void;

  /**
   * May be called any number of times, if already stopped, has no effect.  Synchronizers can be stopped, whereas initializers don't need to be.
   * @param cb
   * @returns
   */
  stop(): void;
}

export interface SynchronizerFactory {
  create(): DataSystemSynchronizer;
}
