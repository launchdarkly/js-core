import { Platform } from 'react-native';
import {
  getApplicationName,
  getBundleId,
  getManufacturerSync,
  getMaxMemorySync,
  getModel,
  getReadableVersion,
  getTotalDiskCapacitySync,
  getVersion,
} from 'react-native-device-info';

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
      key: '', // TODO: needs context key
      envAttributesVersion: '1.0',
      id: getBundleId(),
      name: getApplicationName(),
      version: getVersion(),
      versionName: getReadableVersion(),
      locale: '', // TODO: needs https://github.com/zoontek/react-native-localize
    },
    ld_device: {
      key: '',
      envAttributesVersion: '1.0',
      manufacturer: getManufacturerSync(),
      model: getModel(), // "iPhone 11 Pro" or "Samsung Galaxy S10"
      storageBytes: getTotalDiskCapacitySync().toString(),
      memoryBytes: getMaxMemorySync().toString(),
      os: {
        family: Platform.OS, // TODO: investigate more
        name: Platform.OS,
        version: Platform.Version.toString(),
      },
    },
  };
}
