/* eslint-disable class-methods-use-this */
import { BigSegmentStoreStatusProvider, BigSegmentStoreStatus } from './api/interfaces';

export default class BigSegmentStoreStatusProviderImpl implements BigSegmentStoreStatusProvider {
  private lastStatus: BigSegmentStoreStatus | undefined;

  private listener?: (status: BigSegmentStoreStatus) => void;

  constructor(
    private readonly onRequestStatus: () => Promise<void>,
  ) {
  }

  /**
   * Gets the current status of the store, if known.
   *
   * @returns a {@link BigSegmentStoreStatus}, or `undefined` if the SDK has not yet queried the
   *   Big Segment store status
   */
  getStatus(): BigSegmentStoreStatus | undefined {
    return this.lastStatus;
  }

  /**
   * Gets the current status of the store, querying it if the status has not already been queried.
   *
   * @returns a Promise for the status of the store
   */
  async requireStatus(): Promise<BigSegmentStoreStatus> {
    if (!this.lastStatus) {
      await this.onRequestStatus();
    }

    // Status will be defined at this point.
    return this.lastStatus!;
  }

  dispatch(status: BigSegmentStoreStatus) {
    this.listener?.(status);
  }

  setListener(listener: (status: BigSegmentStoreStatus) => void) {
    this.listener = listener;
  }

  setStatus(status: BigSegmentStoreStatus) {
    this.lastStatus = status;
  }
}
