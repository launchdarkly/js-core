/* eslint-disable class-methods-use-this */
import { BigSegmentStoreStatusProvider, BigSegmentStoreStatus } from './api/interfaces';

export default class BigSegmentStoreStatusProviderImpl implements BigSegmentStoreStatusProvider {
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
   * This should be overridden by derived implementations.
   * @param eventType
   * @param status
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dispatch(eventType: string, status: BigSegmentStoreStatus) {}
}
