import { LDLogger, interfaces } from '@launchdarkly/node-server-sdk';
import LDDynamoDBOptions from './LDDynamoDBOptions';
import DynamoDBClientState from './DynamoDBClientState';
import { stringValue } from './Value';

/**
 * Exported for testing.
 * @internal
 */
export const KEY_METADATA = 'big_segments_metadata';

/**
 * Exported for testing.
 * @internal
 */
export const KEY_USER_DATA = 'big_segments_user';

/**
 * Exported for testing.
 * @internal
 */
export const ATTR_SYNC_ON = 'synchronizedOn';

/**
 * Exported for testing.
 * @internal
 */
export const ATTR_INCLUDED = 'included';

/**
 * Exported for testing.
 * @internal
 */
export const ATTR_EXCLUDED = 'excluded';

export default class DynamoDBBigSegmentStore implements interfaces.BigSegmentStore {
  private state: DynamoDBClientState;

  // Logger is not currently used, but is included to reduce the chance of a
  // compatibility break to add a log.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(
    private readonly tableName: string,
    options?: LDDynamoDBOptions,
    private readonly logger?: LDLogger,
  ) {
    this.state = new DynamoDBClientState(options);
  }

  async getMetadata(): Promise<interfaces.BigSegmentStoreMetadata | undefined> {
    const key = this.state.prefixedKey(KEY_METADATA);
    const data = await this.state.get(this.tableName, {
      namespace: stringValue(key),
      key: stringValue(key),
    });
    if (data) {
      const attr = data[ATTR_SYNC_ON];
      if (attr && attr.N) {
        return { lastUpToDate: parseInt(attr.N!, 10) };
      }
    }
    return {};
  }

  async getUserMembership(
    userHash: string,
  ): Promise<interfaces.BigSegmentStoreMembership | undefined> {
    const data = await this.state.get(this.tableName, {
      namespace: stringValue(this.state.prefixedKey(KEY_USER_DATA)),
      key: stringValue(userHash),
    });
    if (data) {
      const excludedRefs = data[ATTR_EXCLUDED];
      const includedRefs = data[ATTR_INCLUDED];

      const membership: interfaces.BigSegmentStoreMembership = {};

      excludedRefs?.SS?.forEach((ref) => {
        membership[ref] = false;
      });
      includedRefs?.SS?.forEach((ref) => {
        membership[ref] = true;
      });
      return membership;
    }
    return undefined;
  }

  close(): void {
    this.state.close();
  }
}
