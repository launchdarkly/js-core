import { DataSourceErrorKind } from '@launchdarkly/js-sdk-common';

import LDEmitter from '../LDEmitter';
import DataSourceStatus, { DataSourceState } from './DataSourceStatus';
import DataSourceStatusErrorInfo from './DataSourceStatusErrorInfo';

/**
 * Tracks the current data source status and emits updates when the status changes.
 */
export default class DataSourceStatusManager {
  private _state: DataSourceState;
  private _stateSinceMillis: number; // UNIX epoch timestamp in milliseconds
  private _errorInfo?: DataSourceStatusErrorInfo;
  private _timeStamper: () => number;

  constructor(
    private readonly _emitter: LDEmitter,
    timeStamper: () => number = () => Date.now(),
  ) {
    this._state = DataSourceState.Closed;
    this._stateSinceMillis = timeStamper();
    this._timeStamper = timeStamper;
  }

  get status(): DataSourceStatus {
    return {
      state: this._state,
      stateSince: this._stateSinceMillis,
      lastError: this._errorInfo,
    };
  }

  /**
   * Updates the state of the manager.
   *
   * @param requestedState to track
   * @param isError to indicate that the state update is a result of an error occurring.
   */
  private _updateState(requestedState: DataSourceState, isError = false) {
    const newState =
      requestedState === DataSourceState.Interrupted && this._state === DataSourceState.Initializing // don't go to interrupted from initializing (recoverable errors when initializing are not noteworthy)
        ? DataSourceState.Initializing
        : requestedState;

    const changedState = this._state !== newState;
    if (changedState) {
      this._state = newState;
      this._stateSinceMillis = this._timeStamper();
    }

    if (changedState || isError) {
      this._emitter.emit('dataSourceStatus', this.status);
    }
  }

  /**
   * Requests the manager move to the provided state.  This request may be ignored
   * if the current state cannot transition to the requested state.
   * @param state that is requested
   */
  requestStateUpdate(state: DataSourceState) {
    this._updateState(state);
  }

  /**
   * Reports a datasource error to this manager. Since the {@link DataSourceStatus} includes error
   * information, it is possible that that a {@link DataSourceStatus} update is emitted with
   * the same {@link DataSourceState}.
   *
   * @param kind of the error
   * @param message for the error
   * @param statusCode of the error if there was one
   * @param recoverable to indicate that the error is anticipated to be recoverable
   */
  reportError(
    kind: DataSourceErrorKind,
    message: string,
    statusCode?: number,
    recoverable: boolean = false,
  ) {
    const errorInfo: DataSourceStatusErrorInfo = {
      kind,
      message,
      statusCode,
      time: this._timeStamper(),
    };
    this._errorInfo = errorInfo;
    this._updateState(recoverable ? DataSourceState.Interrupted : DataSourceState.Closed, true);
  }

  // TODO: SDK-702 - Implement network availability behaviors
  // setNetworkUnavailable() {
  //   this.updateState(DataSourceState.NetworkUnavailable);
  // }
}
