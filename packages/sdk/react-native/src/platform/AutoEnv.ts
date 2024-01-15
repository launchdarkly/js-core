import { Platform } from 'react-native';

import type { LDAutoEnv, LDAutoEnvCommon } from '@launchdarkly/js-sdk-common';

import locale from '../utils/locale';

/**
 * Priority for id, version and versionName:
 *
 * 1. Customer provided values via configuration or provided otherwise
 * 2. Application info collected from the platform via platform APIs
 * 3. LaunchDarkly SDK info such as SDK name and version
 */
const common: LDAutoEnvCommon = {
  key: '',
  envAttributesVersion: '1.0',
};

const autoEnv: LDAutoEnv = {
  ld_application: {
    ...common,
    // id: getBundleId(),
    // name: getApplicationName(),
    // version: getVersion(),
    // versionName: getReadableVersion(),
    locale,
  },
  ld_device: {
    ...common,
    // manufacturer: getManufacturerSync(),
    // model: getModel(),
    // storageBytes: getTotalDiskCapacitySync().toString()
    // memoryBytes: getMaxMemorySync().toString(),
    os: {
      family: Platform.select({
        ios: 'apple',
        default: Platform.OS,
      }),
      name: Platform.OS,
      version: Platform.Version.toString(),
    },
  },
};

console.log(`===== autoenv: ${JSON.stringify(autoEnv, null, 2)}`);

export default autoEnv;
