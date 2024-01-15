/* eslint-disable import/no-mutable-exports,global-require */
import { Platform } from 'react-native';

import type { LDAutoEnv, LDAutoEnvCommon } from '@launchdarkly/js-sdk-common';

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

const defaultAutoEnv: LDAutoEnv = {
  ld_application: {
    ...common,
  },
  ld_device: {
    ...common,
    os: {
      family: Platform.OS,
      name: Platform.OS,
      version: Platform.Version.toString(),
    },
  },
};

let autoEnv = defaultAutoEnv;

try {
  const {
    getApplicationName,
    getBundleId,
    getManufacturerSync,
    getMaxMemorySync,
    getModel,
    getReadableVersion,
    getTotalDiskCapacitySync,
    getVersion,
  } = require('react-native-device-info');
  const { getLocales } = require('react-native-localize');

  console.log(`======= DeviceInfo supported`);

  autoEnv = {
    // @ts-ignore
    ld_application: {
      ...defaultAutoEnv.ld_application,
      id: getBundleId(),
      name: getApplicationName(),
      version: getVersion(),
      versionName: getReadableVersion(),
      locale: getLocales()[0].languageTag,
    },
    // @ts-ignore
    ld_device: {
      ...defaultAutoEnv.ld_device,
      manufacturer: getManufacturerSync(),
      model: getModel(),
      storageBytes: getTotalDiskCapacitySync().toString(),
      memoryBytes: getMaxMemorySync().toString(),
    },
  };
} catch (e) {
  console.log(`======= DeviceInfo not supported, using default values. Error: ${e}`);
}

export default autoEnv;
