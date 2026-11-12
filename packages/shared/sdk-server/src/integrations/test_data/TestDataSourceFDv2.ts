import { internal, subsystem } from '@launchdarkly/js-sdk-common';

/**
 * How the data system uses an FDv2 test data source.
 *
 * @internal
 */
export type TestDataSourceFDv2Role = 'initializer' | 'synchronizer';

/**
 * An FDv2 data source that gets its data from a `TestData` instance. It does not use the
 * network.
 *
 * As an initializer, the source sends one full payload of the current data and then closes. As a
 * synchronizer, the source sends one full payload of the current data. Then it sends each change
 * payload that the `TestData` instance gives to it, until it stops.
 *
 * @internal
 */
export default class TestDataSourceFDv2 implements subsystem.DataSource {
  private _started = false;

  private _dataCallback?: (basis: boolean, data: any) => void;

  /**
   * @param _role How the data system uses this source.
   * @param _makeFullPayload Makes a full payload of the current test data.
   * @param _onStart Receives this source when it starts as a synchronizer.
   * @param _onStop Receives this source when it stops.
   */
  constructor(
    private readonly _role: TestDataSourceFDv2Role,
    private readonly _makeFullPayload: () => internal.Payload,
    private readonly _onStart: (source: TestDataSourceFDv2) => void,
    private readonly _onStop: (source: TestDataSourceFDv2) => void,
  ) {}

  start(
    dataCallback: (basis: boolean, data: any) => void,
    statusCallback: (status: subsystem.DataSourceState, err?: any) => void,
  ): void {
    if (this._started) {
      return;
    }
    this._started = true;

    if (this._role === 'initializer') {
      statusCallback(subsystem.DataSourceState.Valid);
      this._sendFullPayload(dataCallback);
      statusCallback(subsystem.DataSourceState.Closed);
      return;
    }

    this._dataCallback = dataCallback;
    this._onStart(this);
    statusCallback(subsystem.DataSourceState.Valid);
    this._sendFullPayload(dataCallback);
  }

  private _sendFullPayload(dataCallback: (basis: boolean, data: any) => void): void {
    const payload = this._makeFullPayload();
    // A full payload without a selector is not a basis. Thus, after an initializer, the data
    // system runs the next initializer.
    dataCallback(!!payload.state, { payload });
  }

  /**
   * Sends a change payload to the data system.
   */
  sendPayload(payload: internal.Payload): void {
    this._dataCallback?.(false, { payload });
  }

  stop(): void {
    this._dataCallback = undefined;
    this._onStop(this);
  }
}
