/* eslint-disable class-methods-use-this */
import { BigSegmentStoreStatus } from './api/interfaces';

type StatusHandler = (status: BigSegmentStoreStatus) => void;

export default class BigSegmentStoreStatusProvider {
  private onStatus?: StatusHandler;

  /**
   * Gets the current status of the store, if known.
   *
   * @returns a {@link BigSegmentStoreStatus}, or `undefined` if the SDK has not yet queried the
   *   Big Segment store status
   */
  getStatus(): BigSegmentStoreStatus | undefined {
    return undefined;
  }

  /**
   * Gets the current status of the store, querying it if the status has not already been queried.
   *
   * @returns a Promise for the status of the store
   */
  async requireStatus(): Promise<BigSegmentStoreStatus> {
    return Promise.reject();
  }

  /**
   * Set the status handler. Only one handler can be registered and this will replace the existing
   * handler.
   * @param handler
   */
  setStatusHandler(handler: StatusHandler) {
    this.onStatus = handler;
  }
}
