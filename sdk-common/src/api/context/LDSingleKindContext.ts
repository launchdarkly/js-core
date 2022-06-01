import { LDContextCommon } from './LDContextCommon';

/**
 *
 * TODO: U2C How do we want to describe this?
 *
 * A single-kind context.
 */
export interface LDSingleKindContext extends LDContextCommon {
  /**
   * The kind of the context.
   */
  kind: string;
}
