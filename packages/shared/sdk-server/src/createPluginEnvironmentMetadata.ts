import { LDPluginEnvironmentMetadata, Platform } from '@launchdarkly/js-sdk-common';

import Configuration from './options/Configuration';

/**
 * Mutable utility type to allow building up a readonly object from a mutable one.
 */
type Mutable<T> = {
  -readonly [P in keyof T]: Mutable<T[P]>;
};

export function createPluginEnvironmentMetadata(
  _platform: Platform,
  _sdkKey: string,
  config: Configuration,
) {
  const environmentMetadata: Mutable<LDPluginEnvironmentMetadata> = {
    sdk: {
      name: _platform.info.sdkData().userAgentBase!,
      version: _platform.info.sdkData().version!,
    },
    sdkKey: _sdkKey,
  };

  if (_platform.info.sdkData().wrapperName) {
    environmentMetadata.sdk.wrapperName = _platform.info.sdkData().wrapperName;
  }
  if (_platform.info.sdkData().wrapperVersion) {
    environmentMetadata.sdk.wrapperVersion = _platform.info.sdkData().wrapperVersion;
  }
  if (config.applicationInfo) {
    environmentMetadata.application = config.applicationInfo;
  }
  return environmentMetadata;
}
