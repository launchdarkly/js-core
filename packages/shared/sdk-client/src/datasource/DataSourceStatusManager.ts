import LDEmitter from '../LDEmitter';
import DataSourceStatus, { DataSourceState } from './DataSourceStatus';
import DataSourceStatusErrorInfo from './DataSourceStatusErrorInfo';

/**
 * Tracks the current data source status and emits updates when the status changes.
 */
export default class DataSourceStatusManager {
  private state: DataSourceState;
  private stateSinceMillis: number; // UNIX epoch timestamp in milliseconds
  private errorInfo?: DataSourceStatusErrorInfo;
  private timeStamper: () => number;

  constructor(
    private readonly emitter: LDEmitter,
    timeStamper: () => number = () => Date.now(),
  ) {
    this.state = DataSourceState.Closed;
    this.stateSinceMillis = timeStamper();
    this.timeStamper = timeStamper;
  }

  get status(): DataSourceStatus {
    return {
      state: this.state,
      stateSince: this.stateSinceMillis,
      lastError: this.errorInfo,
    };
  }

  /**
   * Updates the state of the manager.
   *
   * @param requestedState to track
   * @param isError to indicate that the state update is a result of an error occurring.
   */
  private updateState(requestedState: DataSourceState, isError = false) {
    const newState =
      requestedState === DataSourceState.Interrupted && this.state === DataSourceState.Initializing // don't go to interrupted from initializing (recoverable errors when initializing are not noteworthy)
        ? DataSourceState.Initializing
        : requestedState;

    const changedState = this.state !== newState;
    if (changedState) {
      this.state = newState;
      this.stateSinceMillis = this.timeStamper();
    }

    if (changedState || isError) {
      this.emitter.emit('dataSourceStatus', this.status);
    }
  }

  /**
   * Requests the manager move to the provided state.  This request may be ignored
   * if the current state cannot transition to the requested state.
   * @param state that is requested
   */
  requestStateUpdate(state: DataSourceState) {
    this.updateState(state);
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
      time: this.timeStamper(),
    };
    this.errorInfo = errorInfo;
    this.updateState(recoverable ? DataSourceState.Interrupted : DataSourceState.Closed, true);
  }

  // TODO: SDK-702 - Implement network availability behaviors
  // setNetworkUnavailable() {
  //   this.updateState(DataSourceState.NetworkUnavailable);
  // }
}
