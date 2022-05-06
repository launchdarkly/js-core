import { LDContextCommon } from './LDContextCommon';

/**
 *
 * TODO: U2C How do we want to describe this?
 *
 * A multi-kind context.
 */
export interface LDMultiKindContext {
  /**
   * The kind of the context.
   */
  kind: "multi";

  /**
   * The contexts which compose this multi-kind context.
   *
   * These should be of type LDContextCommon. "multi" is to allow
   * for the top level "kind" attribute.
   */
  [kind: string]: "multi" | LDContextCommon;
}
