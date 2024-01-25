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
    family: string;
    name: string;
    version: string;
  };
}
