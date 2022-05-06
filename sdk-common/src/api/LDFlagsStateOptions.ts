/**
 * Optional settings that can be passed to [[LDClient.allFlagsState]].
 */

export interface LDFlagsStateOptions {
  /**
   * True if the state should include only flags that have been marked for use with the
   * client-side SDK. By default, all flags are included.
   */
  clientSideOnly?: boolean;
  /**
   * True if evaluation reason data should be captured in the state object (see LDClient.variationDetail).
   * By default, it is not.
   */
  withReasons?: boolean;
  /**
   * True if any flag metadata that is normally only used for event generation-- such as flag versions and
   * evaluation reasons-- should be omitted for any flag that does not have event tracking or debugging turned on.
   * This reduces the size of the JSON data if you are passing the flag state to the front end.
   */
  detailsOnlyForTrackedFlags?: boolean;
}
