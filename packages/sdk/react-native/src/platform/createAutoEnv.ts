import type { LDAutoEnv } from '@launchdarkly/js-sdk-common';

export default function createAutoEnv(): LDAutoEnv {
  // TODO: populate env fields correctly
  return {
    ld_application: {
      /**
       * Priority for id, version and versionName:
       *
       * 1. Customer provided values via configuration or provided otherwise
       * 2. Application info collected from the platform via platform APIs
       * 3. LaunchDarkly SDK info such as SDK name and version
       */
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
