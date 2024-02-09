import { Platform, type PlatformAndroidStatic } from 'react-native';

import type { LDApplication, LDDevice } from '@launchdarkly/js-client-sdk-common';

import locale from './locale';

export const ldApplication: LDApplication = {
  // key is populated by common/client-sdk
  key: '',
  envAttributesVersion: '1.0',

  locale,

  // These are not automatically generated. Use LDOptions.applicationInfo
  // to specify these values.
  id: '',
  name: '',
  version: '',
  versionName: '',
};

export const ldDevice: LDDevice = {
  // key is populated by common/client-sdk
  key: '',
  envAttributesVersion: '1.0',
  manufacturer: Platform.select({
    ios: 'apple',
    android: (Platform as PlatformAndroidStatic).constants?.Manufacturer,
  }),
  model: Platform.select({
    // ios: model n/a from PlatformIOSStatic
    android: (Platform as PlatformAndroidStatic).constants?.Model,
  }),
  os: {
    family: Platform.select({
      ios: 'apple',
      default: Platform.OS,
    }),
    name: Platform.OS,
    version: Platform.Version?.toString(),
  },
};
