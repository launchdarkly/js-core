export interface Data {}

export enum HealthStatus {
  Online,
  Interrupted,
}

export interface DataSource {
  /**
   * May be called any number of times, if already started, has no effect
   * @param cb may be invoked many times
   * @returns
   */
  run(dataCallback: (basis: boolean, data: Data) => void, errorHander: (err: any) => void): void;
}

export interface DataSourceWithStatus {
  /**
   * May be called any number of times, if already started, has no effect
   * @param cb may be invoked many times
   * @returns
   */
  run(
    dataCallback: (basis: boolean, data: Data) => void,
    statusCallback: (status: HealthStatus, durationMS: number) => void,
    errorHander: (err: any) => void,
  ): void;
}
