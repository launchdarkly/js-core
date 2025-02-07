import { Data, HealthStatus } from './DataSource';

/**
 * Will make best effort to retrieve all data. Data recieved will be reported via the {@link dataCallback}. Status changes
 * will be reported via the {@link statusCallback}. Errors will be reported via the {@link errorCallback}.
 */
export interface DataSystemInitializer {
  run(
    dataCallback: (basis: boolean, data: Data) => void,
    statusCallback: (status: HealthStatus, durationMS: number) => void,
    errorCallback: (err: Error) => void,
  ): void;

  /**
   * May be called any number of times, if already stopped, has no effect.
   * @param cb
   * @returns
   */
  stop(): void;
}

export interface InitializerFactory {
  create(): DataSystemInitializer;
}
