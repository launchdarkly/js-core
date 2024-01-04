import type { LDAutoEnv } from '@launchdarkly/js-sdk-common';

export default function createAutoEnv(): LDAutoEnv {
  // TODO: populate env fields correctly
  return {
    ld_application: {
      key: '',
      envAttributesVersion: '',
      id: '',
      name: '',
      version: '',
      versionName: '',
      locale: '',
    },
    ld_device: {
      key: '',
      envAttributesVersion: '',
      manufacturer: '',
      model: '',
      storageBytes: '',
      memoryBytes: '',
      os: {
        family: '',
        name: '',
        version: '',
      },
    },
  };
}
