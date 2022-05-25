import { LDContextMeta } from './LDContextMeta';

export interface LDContextCommon {
  /**
   * A unique string identifying a context.
   */
  key: string;

  /**
   * The context's name.
   *
   * You can search for contexts on the Contexts page by name.
   */
  name?: string;

  /**
   *
   * TODO: U2C We will need some uniform description for this.
   *
   * Meta attributes are used to control behavioral aspects of the Context.
   * They cannot be addressed in targetting rules.
   */
  _meta?: LDContextMeta;

  /**
   * If true, the context will _not_ appear on the Contexts page in the LaunchDarkly dashboard.
   */
  transient?: boolean;

  /**
   * Any additional attributes associated with the context.
   */
  [attribute: string]: any;
}
