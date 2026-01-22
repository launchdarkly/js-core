import { DataSourceErrorKind } from '@launchdarkly/js-sdk-common';

import LDEmitter from '../LDEmitter';
import DataSourceStatus, { type DataSourceState } from './DataSourceStatus';
import DataSourceStatusErrorInfo from './DataSourceStatusErrorInfo';

/**
 * Tracks the current data source status and emits updates when the status changes.
 */
export interface DataSourceStatusManager {
  readonly status: DataSourceStatus;

  /**
   * Requests the manager move to the provided state. This request may be ignored
   * if the current state cannot transition to the requested state.
   * @param state that is requested
   */
  requestStateUpdate(state: DataSourceState): void;

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
    recoverable?: boolean,
  ): void;

  // TODO: SDK-702 - Implement network availability behaviors
  // setNetworkUnavailable(): void;
}

export function createDataSourceStatusManager(
  emitter: LDEmitter,
  timeStamper: () => number = () => Date.now(),
): DataSourceStatusManager {
  let state: DataSourceState = 'CLOSED';
  let stateSinceMillis: number = timeStamper();
  let errorInfo: DataSourceStatusErrorInfo | undefined;

  function getStatus(): DataSourceStatus {
    return {
      state,
      stateSince: stateSinceMillis,
      lastError: errorInfo,
    };
  }

  function updateState(requestedState: DataSourceState, isError = false) {
    const newState =
      requestedState === 'INTERRUPTED' && state === 'INITIALIZING' // don't go to interrupted from initializing (recoverable errors when initializing are not noteworthy)
        ? 'INITIALIZING'
        : requestedState;

    const changedState = state !== newState;
    if (changedState) {
      state = newState;
      stateSinceMillis = timeStamper();
    }

    if (changedState || isError) {
      emitter.emit('dataSourceStatus', getStatus());
    }
  }

  return {
    get status(): DataSourceStatus {
      return getStatus();
    },

    requestStateUpdate(requestedState: DataSourceState) {
      updateState(requestedState);
    },

    reportError(
      kind: DataSourceErrorKind,
      message: string,
      statusCode?: number,
      recoverable: boolean = false,
    ) {
      errorInfo = {
        kind,
        message,
        statusCode,
        time: timeStamper(),
      };
      updateState(recoverable ? 'INTERRUPTED' : 'CLOSED', true);
    },

    // TODO: SDK-702 - Implement network availability behaviors
    // setNetworkUnavailable() {
    //   updateState(DataSourceState.NetworkUnavailable);
    // },
  };
}

export default DataSourceStatusManager;
