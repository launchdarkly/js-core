/* eslint-disable import/prefer-default-export */
/**
 * Enable / disable Auto environment attributes. When enabled, the SDK will automatically
 * provide data about the mobile environment where the application is running. This data makes it simpler to target
 * your mobile customers based on application name or version, or on device characteristics including manufacturer,
 * model, operating system, locale, and so on. We recommend enabling this when you configure the SDK. To learn more,
 * read [Automatic environment attributes](https://docs.launchdarkly.com/sdk/features/environment-attributes).
 * for more documentation.
 */
export enum AutoEnvAttributes {
  Disabled,
  Enabled,
}

interface AutoEnvCommon {
  /**
   * Unique key for the context kind.
   */
  key: string;

  /**
   * Version of the environment attributes schema being used.
   */
  envAttributesVersion: string;
}

export interface LDApplication extends AutoEnvCommon {
  /**
   * Unique identifier of the application.
   */
  id?: string;
  name?: string;
  version?: string;
  versionName?: string;
  locale?: string;
}

export interface LDDevice extends AutoEnvCommon {
  manufacturer?: string;
  model?: string;
  storageBytes?: string;
  memoryBytes?: string;
  os?: {
    /**
     * The family of operating system.
     */
    family?: string;
    name?: string;
    version?: string;
  };
}
