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
import { getLocales } from 'react-native-localize';

import type { LDAutoEnv } from '@launchdarkly/js-sdk-common';

// const sampleAutoEnv = {
//   ld_application: {
//     key: '',
//     envAttributesVersion: '1.0',
//     id: 'com.anonymous.reactnativeexample',
//     name: 'react-native-example',
//     version: '1.0.0',
//     versionName: '1.0.0.1',
//     locale: 'en-US',
//   },
//   ld_device: {
//     key: '',
//     envAttributesVersion: '1.0',
//     manufacturer: 'Apple',
//     model: 'iPhone SE',
//     storageBytes: '494384795648',
//     memoryBytes: '-1',
//     os: { family: 'ios', name: 'ios', version: '17.2' },
//   },
// };
export default function createAutoEnv(): LDAutoEnv {
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
      envAttributesVersion: '1.0',
      id: getBundleId(),
      name: getApplicationName(),
      version: getVersion(),
      versionName: getReadableVersion(),
      locale: getLocales()[0].languageTag,
    },
    ld_device: {
      key: '',
      envAttributesVersion: '1.0',
      manufacturer: getManufacturerSync(),
      model: getModel(),
      storageBytes: getTotalDiskCapacitySync().toString(),
      memoryBytes: getMaxMemorySync().toString(),
      os: {
        family: Platform.OS,
        name: Platform.OS,
        version: Platform.Version.toString(),
      },
    },
  };
}
