/**
 *
 * TODO: U2C We will need some uniform description for this.
 *
 * Meta attributes are used to control behavioral aspects of the Context. They
 * cannot be addressed in targeting rules.
 */
export interface LDContextMeta {
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
