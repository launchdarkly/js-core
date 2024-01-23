/* eslint-disable @typescript-eslint/naming-convention */
import {
  clone,
  internal,
  LDApplication,
  LDContext,
  LDDevice,
  LDMultiKindContext,
  LDSingleKindContext,
  LDUser,
  Platform,
} from '@launchdarkly/js-sdk-common';

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
 * Clones the LDApplication object and populates the key, id and version fields.
 *
 * @param crypto
 * @param info
 * @param config
 * @return An LDApplication object with populated key, id and version.
 */
export const injectApplication = ({ crypto, info }: Platform, config: Configuration) => {
  const { name, version, wrapperName, wrapperVersion } = info.sdkData();
  const { ld_application } = info.platformData();

  const ldApplication = clone<LDApplication>(ld_application) ?? {};
  ldApplication.id = config.application?.id || ldApplication?.id || name || wrapperName;
  ldApplication.name = ldApplication?.name || name || wrapperName;
  ldApplication.version =
    config.application?.version || ldApplication.version || version || wrapperVersion;

  const hasher = crypto.createHash('sha256');
  hasher.update(ldApplication.id!);
  ldApplication.key = hasher.digest('base64');
  ldApplication.envAttributesVersion =
    ldApplication.envAttributesVersion || defaultAutoEnvSchemaVersion;

  return ldApplication;
};

/**
 * Clones the LDDevice object and populates the key field.
 *
 * @param platform
 * @return An LDDevice object with populated key.
 */
export const injectDevice = async (platform: Platform) => {
  const { ld_device, os } = platform.info.platformData();
  const ldDevice = clone<LDDevice>(ld_device);

  ldDevice.os.name = os?.name || ldDevice.os.name;
  ldDevice.os.version = os?.version || ldDevice.os.version;
  ldDevice.key = await getOrGenerateKey('ld_device', platform);
  ldDevice.envAttributesVersion = ldDevice.envAttributesVersion || defaultAutoEnvSchemaVersion;

  return ldDevice;
};

export const injectAutoEnv = async (
  context: LDContext,
  platform: Platform,
  config: Configuration,
) => {
  // LDUser is not supported for auto env reporting
  if (isLegacyUser(context)) {
    return context as LDUser;
  }

  const multi = isSingleKind(context) ? toMulti(context) : context;

  return {
    ...multi,
    ld_application: injectApplication(platform, config),
    ld_device: await injectDevice(platform),
  } as LDMultiKindContext;
};
