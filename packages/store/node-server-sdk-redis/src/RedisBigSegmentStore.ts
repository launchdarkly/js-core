import { interfaces, LDLogger } from '@launchdarkly/node-server-sdk';

import LDRedisOptions from './LDRedisOptions';
import RedisClientState from './RedisClientState';

/**
 * @internal
 */
export const KEY_LAST_SYNCHRONIZED = 'big_segments_synchronized_on';

/**
 * @internal
 */
export const KEY_USER_INCLUDE = 'big_segment_include';

/**
 * @internal
 */
export const KEY_USER_EXCLUDE = 'big_segment_exclude';

export default class RedisBigSegmentStore implements interfaces.BigSegmentStore {
  private _state: RedisClientState;

  // Logger is not currently used, but is included to reduce the chance of a
  // compatibility break to add a log.
  constructor(options?: LDRedisOptions, _logger?: LDLogger) {
    this._state = new RedisClientState(options);
  }

  async getMetadata(): Promise<interfaces.BigSegmentStoreMetadata | undefined> {
    const value = await this._state.getClient().get(this._state.prefixedKey(KEY_LAST_SYNCHRONIZED));
    // Value will be true if it is a string containing any characters, which is fine
    // for this check.
    if (value) {
      return { lastUpToDate: parseInt(value, 10) };
    }
    return {};
  }

  async getUserMembership(
    userHash: string,
  ): Promise<interfaces.BigSegmentStoreMembership | undefined> {
    const includedRefs = await this._state
      .getClient()
      .smembers(this._state.prefixedKey(`${KEY_USER_INCLUDE}:${userHash}`));
    const excludedRefs = await this._state
      .getClient()
      .smembers(this._state.prefixedKey(`${KEY_USER_EXCLUDE}:${userHash}`));

    // If there are no included/excluded refs, the don't return any membership.
    if ((!includedRefs || !includedRefs.length) && (!excludedRefs || !excludedRefs.length)) {
      return undefined;
    }

    const membership: interfaces.BigSegmentStoreMembership = {};

    excludedRefs?.forEach((ref) => {
      membership[ref] = false;
    });
    includedRefs?.forEach((ref) => {
      membership[ref] = true;
    });

    return membership;
  }

  close(): void {
    this._state.close();
  }
}
