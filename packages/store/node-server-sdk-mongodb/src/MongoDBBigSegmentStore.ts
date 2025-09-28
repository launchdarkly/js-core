import { interfaces, LDLogger } from '@launchdarkly/node-server-sdk';

import LDMongoDBOptions from './LDMongoDBOptions';
import MongoDBClientState from './MongoDBClientState';

/**
 * @internal
 */
export const COLLECTION_BIG_SEGMENTS_METADATA = 'big_segments_metadata';

/**
 * @internal
 */
export const COLLECTION_BIG_SEGMENTS_USER = 'big_segments_user';

/**
 * @internal
 */
export const METADATA_KEY = 'big_segments_metadata';

/**
 * @internal
 */
export const FIELD_LAST_UP_TO_DATE = 'lastUpToDate';

/**
 * @internal
 */
export const FIELD_USER_HASH = 'userHash';

/**
 * @internal
 */
export const FIELD_INCLUDED = 'included';

/**
 * @internal
 */
export const FIELD_EXCLUDED = 'excluded';

/**
 * A MongoDB implementation of the LaunchDarkly BigSegmentStore interface.
 *
 * This store manages big segment data in MongoDB collections. It uses two collections:
 * - One for metadata about when the big segments were last synchronized
 * - One for user membership data (which segments include/exclude specific users)
 */
export default class MongoDBBigSegmentStore implements interfaces.BigSegmentStore {
  private _state: MongoDBClientState;

  /**
   * Creates a new MongoDB big segment store.
   *
   * @param options Optional MongoDB configuration options
   * @param _logger Optional logger instance (reserved for future use)
   */
  constructor(options?: LDMongoDBOptions, private readonly _logger?: LDLogger) {
    this._state = new MongoDBClientState(options);
  }

  /**
   * Retrieves metadata about the big segments store, specifically the last update timestamp.
   *
   * @returns Promise resolving to metadata object containing lastUpToDate timestamp, or empty object if no metadata exists
   */
  async getMetadata(): Promise<interfaces.BigSegmentStoreMetadata | undefined> {
    try {
      const metadataCollection = await this._state.getCollection(COLLECTION_BIG_SEGMENTS_METADATA);

      const metadata = await metadataCollection.findOne({ _id: METADATA_KEY });

      if (metadata && metadata[FIELD_LAST_UP_TO_DATE]) {
        return { lastUpToDate: metadata[FIELD_LAST_UP_TO_DATE] };
      }

      return {};
    } catch (error) {
      this._logger?.error(`MongoDB big segment store getMetadata error: ${error}`);
      throw error;
    }
  }

  /**
   * Retrieves the big segment membership information for a specific user.
   *
   * @param userHash The hashed user key to look up
   * @returns Promise resolving to membership object (segment refs mapped to boolean inclusion status), or undefined if user not found
   */
  async getUserMembership(
    userHash: string,
  ): Promise<interfaces.BigSegmentStoreMembership | undefined> {
    try {
      const userCollection = await this._state.getCollection(COLLECTION_BIG_SEGMENTS_USER);

      const userData = await userCollection.findOne({ [FIELD_USER_HASH]: userHash });

      if (!userData) {
        return undefined;
      }

      const membership: interfaces.BigSegmentStoreMembership = {};

      // Process excluded segment references
      if (userData[FIELD_EXCLUDED] && Array.isArray(userData[FIELD_EXCLUDED])) {
        userData[FIELD_EXCLUDED].forEach((segmentRef: string) => {
          membership[segmentRef] = false;
        });
      }

      // Process included segment references
      if (userData[FIELD_INCLUDED] && Array.isArray(userData[FIELD_INCLUDED])) {
        userData[FIELD_INCLUDED].forEach((segmentRef: string) => {
          membership[segmentRef] = true;
        });
      }

      // Return undefined if no membership data was found
      if (Object.keys(membership).length === 0) {
        return undefined;
      }

      return membership;
    } catch (error) {
      this._logger?.error(`MongoDB big segment store getUserMembership error: ${error}`);
      throw error;
    }
  }

  /**
   * Closes the connection to MongoDB.
   */
  close(): void {
    this._state.close();
  }
}
