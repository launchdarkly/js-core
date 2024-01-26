/* eslint-disable @typescript-eslint/naming-convention */
import {
  internal,
  LDApplication,
  LDContext,
  LDDevice,
  LDMultiKindContext,
  LDSingleKindContext,
  LDUser,
  Platform,
} from '@launchdarkly/js-sdk-common';
import deepCompact from '@launchdarkly/js-sdk-common/dist/utils/deepCompact';

import Configuration from '../configuration';
import { getOrGenerateKey } from './getOrGenerateKey';

const { isLegacyUser, isSingleKind } = internal;
const defaultAutoEnvSchemaVersion = '1.0';

export const toMulti = (c: LDSingleKindContext) => {
  const { kind, ...contextCommon } = c;

  return {
    kind: 'multi',
    [kind]: contextCommon,
  };
};

/**
 * Clones the LDApplication object and populates the key, envAttributesVersion, id and version fields.
 *
 * @param crypto
 * @param info
 * @param applicationTags
 * @param config
 * @return An LDApplication object with populated key, envAttributesVersion, id and version.
 */
export const addApplicationInfo = (
  { crypto, info }: Platform,
  { application: applicationTags }: Configuration,
): LDApplication | undefined => {
  const { ld_application } = info.platformData();
  const app = deepCompact<LDApplication>(ld_application) ?? ({} as LDApplication);
  const id = applicationTags?.id || app?.id;

  if (id) {
    app.id = id;

    const version = applicationTags?.version || app?.version;
    if (version) {
      app.version = version;
    }

    const hasher = crypto.createHash('sha256');
    hasher.update(app.id);
    app.key = hasher.digest('base64');
    app.envAttributesVersion = app.envAttributesVersion || defaultAutoEnvSchemaVersion;

    return app;
  }

  return undefined;
};

/**
 * Clones the LDDevice object and populates the key and envAttributesVersion field.
 *
 * @param platform
 * @return An LDDevice object with populated key and envAttributesVersion.
 */
export const addDeviceInfo = async (platform: Platform) => {
  const { ld_device, os } = platform.info.platformData();
  const device = deepCompact<LDDevice>(ld_device) ?? ({} as LDDevice);

  const name = os?.name || device.os?.name;
  const version = os?.version || device.os?.version;
  const family = device.os?.family;

  // only add device.os if there's data
  if (name || version || family) {
    device.os = {
      // only add props if they are defined
      ...(name ? { name } : {}),
      ...(version ? { version } : {}),
      ...(family ? { family } : {}),
    };
  }

  // Check if device has any meaningful data before we return it.
  if (Object.keys(device).filter((k) => k !== 'key' && k !== 'envAttributesVersion').length) {
    device.key = await getOrGenerateKey('ld_device', platform);
    device.envAttributesVersion = device.envAttributesVersion || defaultAutoEnvSchemaVersion;
    return device;
  }

  return undefined;
};

export const addAutoEnv = async (context: LDContext, platform: Platform, config: Configuration) => {
  // LDUser is not supported for auto env reporting
  if (isLegacyUser(context)) {
    return context as LDUser;
  }

  let ld_application: LDApplication | undefined;
  let ld_device: LDDevice | undefined;

  // Check if customer contexts exist. Only override if they are not provided.
  if (context.kind !== 'ld_application' && !context.ld_application) {
    ld_application = addApplicationInfo(platform, config);
  } else {
    config.logger.warn(
      'Not adding ld_application environment attributes because it already exists.',
    );
  }

  if (context.kind !== 'ld_device' && !context.ld_device) {
    ld_device = await addDeviceInfo(platform);
  } else {
    config.logger.warn('Not adding ld_device environment attributes because it already exists.');
  }

  // Unable to automatically add environment attributes for kind: {}.  {} already exists.

  if (ld_application || ld_device) {
    const multi = isSingleKind(context) ? toMulti(context) : context;

    return {
      ...multi,
      ...(ld_application ? { ld_application } : {}),
      ...(ld_device ? { ld_device } : {}),
    } as LDMultiKindContext;
  }

  return context;
};
