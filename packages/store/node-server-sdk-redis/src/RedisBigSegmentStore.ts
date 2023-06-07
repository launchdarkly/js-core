import { LDLogger, interfaces } from '@launchdarkly/node-server-sdk';
import LDRedisOptions from './LDRedisOptions';
import RedisClientState from './RedisClientState';

const KEY_LAST_SYNCHRONIZED = 'big_segments_synchronized_on';
const KEY_USER_INCLUDE = 'big_segment_include:';
const KEY_USER_EXCLUDE = 'big_segment_exclude:';

export default class RedisBigSegmentStore implements interfaces.BigSegmentStore {
  private state: RedisClientState;
  // Logger is not currently used, but is included to reduce the chance of a
  // compatibility break to add a log.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options?: LDRedisOptions, private readonly logger?: LDLogger) {
    this.state = new RedisClientState(options);
  }

  async getMetadata(): Promise<interfaces.BigSegmentStoreMetadata | undefined> {
    const value = await this.state.getClient().get(this.state.prefixedKey(KEY_LAST_SYNCHRONIZED));
    // Value will be true if it is a string containing any characters, which is fine
    // for this check.
    if (value) {
      return { lastUpToDate: parseInt(value) }
    } else {
      return {};
    }
  }

  async getUserMembership(userHash: string): Promise<interfaces.BigSegmentStoreMembership | undefined> {
    const includedRefs = await this.state.getClient().get(
      this.state.prefixedKey(`${KEY_USER_INCLUDE}:${userHash}`));
    const excludedRefs = await this.state.getClient().get(
      this.state.prefixedKey(`${KEY_USER_EXCLUDE}:${userHash}`));

    // If there are no included/excluded refs, the don't return any membership.
    if ((!includedRefs || !includedRefs.length) && (!excludedRefs || !excludedRefs.length)) {
      return undefined;
    }

    const membership: interfaces.BigSegmentStoreMembership = {};
    if (excludedRefs) {
      for (const ref of excludedRefs) {
        membership[ref] = false;
      }
    }

    if (includedRefs) {
      for (const ref of includedRefs) {
        membership[ref] = true;
      }
    }
    return membership;
  }

  close(): void {
    this.state.close();
  }
}
