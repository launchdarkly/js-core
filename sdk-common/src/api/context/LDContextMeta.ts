/**
 *
 * TODO: U2C We will need some uniform description for this.
 *
 * Meta attributes are used to control behavioral aspects of the Context. They
 * cannot be addressed in targetting rules.
 */
export interface LDContextMeta {
  /**
   * If true, the context will _not_ appear on the Contexts page in the LaunchDarkly dashboard.
   */
  transient?: boolean;

  /**
   * An optional secondary key for a context.
   *
   * TODO: U2C Update with new URL when available.
   *
   * This affects [feature flag targeting](https://docs.launchdarkly.com/home/flags/targeting-users#targeting-rules-based-on-user-attributes)
   * as follows: if you have chosen to bucket context by a specific attribute, the secondary key (if
   * set) is used to further distinguish between contexts which are otherwise identical according to
   * that attribute.
   */
  secondary?: string;

  /**
   *
   * TODO: U2C Link to the pointer-like syntax and maybe a name for it?
   *
   * Specifies a list of attribute names (either built-in or custom) which should be
   * marked as private, and not sent to LaunchDarkly in analytics events. This is in
   * addition to any private attributes designated in the global configuration
   * with [[LDOptions.privateAttributes]] or [[LDOptions.allAttributesPrivate]].
   */
  privateAttributes?: string[];
}
