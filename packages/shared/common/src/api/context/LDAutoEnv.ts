export interface LDApplication {
  key: string;
  envAttributesVersion: string;
  id: string;
  name: string;
  version: string;
  versionName: string;
  locale: string;
}

export interface LDDevice {
  key: string;
  envAttributesVersion: string;
  manufacturer: string;
  model: string;
  storageBytes: string;
  memoryBytes: string;
  os: {
    family: string;
    name: string;
    version: string;
  };
}

export interface LDAutoEnv {
  ld_application?: LDApplication;
  ld_device?: LDDevice;
}
