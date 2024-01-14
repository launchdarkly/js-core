export interface LDApplication {
  /**
   * Unique key for the context kind.
   */
  key: string;

  /**
   * Version of the environment attributes schema being used.
   */
  envAttributesVersion: string;

  /**
   * Unique identifier of the application.
   */
  id: string;
  name: string;
  version: string;
  versionName: string;
  locale: string;
}

export interface LDDevice {
  /**
   * Unique key for the context kind.
   */
  key: string;

  /**
   * Version of the environment attributes schema being used.
   */
  envAttributesVersion: string;
  manufacturer: string;
  model: string;
  storageBytes: string;
  memoryBytes: string;
  os: {
    /**
     * The family of operating system.
     */
    family: string;
    name: string;
    version: string;
  };
}

export interface LDAutoEnv {
  ld_application?: LDApplication;
  ld_device?: LDDevice;
}
