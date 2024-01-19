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

const toMulti = (c: LDSingleKindContext) => {
  const { kind, ...contextCommon } = c;

  return {
    kind,
    [c.kind]: contextCommon,
  };
};

const injectApplication = ({ crypto, info }: Platform, config: Configuration) => {
  const { name, version, wrapperName, wrapperVersion } = info.sdkData();
  const { ld_application } = info.platformData();

  const ldApplication = clone<LDApplication>(ld_application);
  ldApplication.id = config.application?.id ?? ldApplication.id ?? name ?? wrapperName;
  ldApplication.version =
    config.application?.version ?? ldApplication.version ?? version ?? wrapperVersion;

  const hasher = crypto.createHash('sha256');
  hasher.update(ldApplication.id!);
  ldApplication.key = hasher.digest('base64');

  return ldApplication;
};

const injectDevice = async (platform: Platform) => {
  const ldDevice = clone<LDDevice>(platform.info.platformData().ld_device);
  if (ldDevice && !ldDevice.key) {
    ldDevice.key = await getOrGenerateKey('ld_device', platform);
  }
  return ldDevice;
};

const injectAutoEnv = async (context: LDContext, platform: Platform, config: Configuration) => {
  // LDUser is not supported for auto env reporting
  if (isLegacyUser(context)) {
    return context as LDUser;
  }

  let multi;
  if (isSingleKind(context)) {
    multi = toMulti(context);
  }

  return {
    ...multi,
    ld_application: injectApplication(platform, config),
    ld_device: await injectDevice(platform),
  } as LDMultiKindContext;
};

export default injectAutoEnv;
