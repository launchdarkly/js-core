/* eslint-disable class-methods-use-this */
import { BigSegmentStoreStatus, BigSegmentStoreStatusProvider } from './api/interfaces';

/**
 * @ignore
 */
export default class BigSegmentStoreStatusProviderImpl implements BigSegmentStoreStatusProvider {
  private _lastStatus: BigSegmentStoreStatus | undefined;

  private _listener?: (status: BigSegmentStoreStatus) => void;

  constructor(private readonly _onRequestStatus: () => Promise<void>) {}

  /**
   * Gets the current status of the store, if known.
   *
   * @returns a {@link BigSegmentStoreStatus}, or `undefined` if the SDK has not yet queried the
   *   Big Segment store status
   */
  getStatus(): BigSegmentStoreStatus | undefined {
    return this._lastStatus;
  }

  /**
   * Gets the current status of the store, querying it if the status has not already been queried.
   *
   * @returns a Promise for the status of the store
   */
  async requireStatus(): Promise<BigSegmentStoreStatus> {
    if (!this._lastStatus) {
      await this._onRequestStatus();
    }

    // Status will be defined at this point.
    return this._lastStatus!;
  }

  notify() {
    if (this._lastStatus) {
      this._listener?.(this._lastStatus);
    }
  }

  setListener(listener: (status: BigSegmentStoreStatus) => void) {
    this._listener = listener;
  }

  setStatus(status: BigSegmentStoreStatus) {
    this._lastStatus = status;
  }
}
