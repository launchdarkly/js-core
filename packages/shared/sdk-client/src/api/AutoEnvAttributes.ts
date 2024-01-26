/* eslint-disable import/prefer-default-export */
/**
 * Enable / disable Auto environment attributes. When enabled, the SDK will automatically
 * provide data about the mobile environment where the application is running. This data makes it simpler to target
 * your mobile customers based on application name or version, or on device characteristics including manufacturer,
 * model, operating system, locale, and so on. We recommend enabling this when you configure the SDK. To learn more,
 * read [Automatic environment attributes](https://docs.launchdarkly.com/sdk/features/environment-attributes).
 * for more documentation.
 *
 * The default is disabled.
 */
export enum AutoEnvAttributes {
  Disabled,
  Enabled,
}
