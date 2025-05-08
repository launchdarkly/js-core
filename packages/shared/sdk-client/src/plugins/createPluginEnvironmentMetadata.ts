import {
  LDPluginApplicationMetadata,
  LDPluginEnvironmentMetadata,
  LDPluginSdkMetadata,
  Platform,
} from '@launchdarkly/js-sdk-common';

import { Configuration } from '../configuration';

/**
 * Mutable utility type to allow building up a readonly object from a mutable one.
 */
type Mutable<T> = {
  -readonly [P in keyof T]: Mutable<T[P]>;
};

export function createPluginEnvironmentMetadata(
  sdkKey: string,
  platform: Platform,
  config: Configuration,
): LDPluginEnvironmentMetadata {
  const sdkData = platform.info.sdkData();

  let applicationMetadata: Mutable<LDPluginApplicationMetadata> | undefined;

  if (config.applicationInfo) {
    if (config.applicationInfo.id) {
      applicationMetadata = applicationMetadata ?? {};
      applicationMetadata.id = config.applicationInfo.id;
    }
    if (config.applicationInfo.version) {
      applicationMetadata = applicationMetadata ?? {};
      applicationMetadata.version = config.applicationInfo.version;
    }
    if (config.applicationInfo.name) {
      applicationMetadata = applicationMetadata ?? {};
      applicationMetadata.name = config.applicationInfo.name;
    }
    if (config.applicationInfo.versionName) {
      applicationMetadata = applicationMetadata ?? {};
      applicationMetadata.versionName = config.applicationInfo.versionName;
    }
  }

  const sdkMetadata: Mutable<LDPluginSdkMetadata> = {
    name: sdkData.userAgentBase!,
    version: sdkData.version!,
  };

  if (sdkData.wrapperName) {
    sdkMetadata.wrapperName = sdkData.wrapperName;
  }

  if (sdkData.wrapperVersion) {
    sdkMetadata.wrapperVersion = sdkData.wrapperVersion;
  }

  const environmentMetadata: Mutable<LDPluginEnvironmentMetadata> = {
    sdk: sdkMetadata,
    [config.credentialType]: sdkKey,
  };
  if (applicationMetadata) {
    environmentMetadata.application = applicationMetadata;
  }

  return environmentMetadata;
}
