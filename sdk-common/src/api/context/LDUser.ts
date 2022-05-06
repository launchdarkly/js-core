/**
 * A LaunchDarkly user object.
 */
export interface LDUser {
  /**
   * A unique string identifying a user.
   */
  key: string;

  /**
   * An optional secondary key for a user.
   *
   * This affects [feature flag targeting](https://docs.launchdarkly.com/home/flags/targeting-users#targeting-rules-based-on-user-attributes)
   * as follows: if you have chosen to bucket users by a specific attribute, the secondary key (if set)
   * is used to further distinguish between users who are otherwise identical according to that attribute.
   */
  secondary?: string;

  /**
   * The user's name.
   *
   * You can search for users on the User page by name.
   */
  name?: string;

  /**
   * The user's first name.
   */
  firstName?: string;

  /**
   * The user's last name.
   */
  lastName?: string;

  /**
   * The user's email address.
   *
   * If an `avatar` URL is not provided, LaunchDarkly will use Gravatar
   * to try to display an avatar for the user on the Users page.
   */
  email?: string;

  /**
   * An absolute URL to an avatar image for the user.
   */
  avatar?: string;

  /**
   * The user's IP address.
   *
   * If you provide an IP, LaunchDarkly will use a geolocation service to
   * automatically infer a `country` for the user, unless you've already
   * specified one.
   */
  ip?: string;

  /**
   * The country associated with the user.
   */
  country?: string;

  /**
   * If true, the user will _not_ appear on the Users page in the LaunchDarkly dashboard.
   */
  anonymous?: boolean;

  /**
   * Any additional attributes associated with the user.
   */
  custom?: {
    [key: string]: string |
    boolean |
    number |
    Array<string | boolean | number>;
  };

  /**
   * Specifies a list of attribute names (either built-in or custom) which should be
   * marked as private, and not sent to LaunchDarkly in analytics events. This is in
   * addition to any private attributes designated in the global configuration
   * with [[LDOptions.privateAttributeNames]] or [[LDOptions.allAttributesPrivate]].
   */
  privateAttributeNames?: Array<string>;
}
