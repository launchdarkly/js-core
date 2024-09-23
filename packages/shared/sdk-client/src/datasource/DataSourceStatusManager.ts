import { internal } from '@launchdarkly/js-sdk-common';

import LDEmitter from '../LDEmitter';
import DataSourceStatus, { DataSourceState } from './DataSourceStatus';
import DataSourceStatusErrorInfo from './DataSourceStatusErrorInfo';

type DataSourceErrorKind = internal.DataSourceErrorKind;

export type DataSourceStatusCallback = (status: DataSourceStatus) => void;

export default class DataSourceStatusManager {
  private state: DataSourceState;
  private stateSinceMillis: number; // UNIX epoch timestamp in milliseconds
  private errorInfo?: DataSourceStatusErrorInfo;
  private timeStamper: () => number;

  // TODO: at the moment the LDEmitter requires an event name internally, would be nice to not need to provide an event name,
  // but perhaps also not worth refactoring/supporting another style
  private emitter: LDEmitter;

  constructor(timeStamper: () => number = () => Date.now()) {
    this.state = DataSourceState.Initializing;
    this.stateSinceMillis = timeStamper();
    this.emitter = new LDEmitter();
    this.timeStamper = timeStamper;
  }

  get status(): DataSourceStatus {
    return {
      state: this.state,
      stateSince: this.stateSinceMillis,
      lastError: this.errorInfo,
    };
  }

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

  off(listener: DataSourceStatusCallback) {
    this.emitter.off('dataSourceStatus', listener);
  }

  on(listener: DataSourceStatusCallback) {
    this.emitter.on('dataSourceStatus', listener);
  }

  setValid() {
    this.updateState(DataSourceState.Valid);
  }

  setOffline() {
    this.updateState(DataSourceState.SetOffline);
  }

  // TODO: SDK-702 - Implement network availability behaviors
  // setNetworkUnavailable() {
  //   this.updateState(DataSourceState.NetworkUnavailable);
  // }

  setShutdown() {
    this.updateState(DataSourceState.Shutdown);
  }

  setError(
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
    this.updateState(recoverable ? DataSourceState.Interrupted : DataSourceState.Shutdown, true);
  }
}
