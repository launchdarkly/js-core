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

const injectAutoEnv = async (context: LDContext, platform: Platform, config: Configuration) => {
  // LDUser is not supported for auto env reporting
  if (isLegacyUser(context)) {
    return context as LDUser;
  }

  let multi;
  const cloned = clone<LDContext>(context);
  if (isSingleKind(cloned)) {
    multi = toMulti(cloned);
  }

  const { crypto, info } = platform;
  const { name, version, wrapperName, wrapperVersion } = info.sdkData();
  const { ld_application, ld_device } = info.platformData();

  const ldApplication = clone<LDApplication>(ld_application);
  ldApplication.id = config.application?.id ?? ldApplication.id ?? name ?? wrapperName;
  ldApplication.version =
    config.application?.version ?? ldApplication.version ?? version ?? wrapperVersion;

  const hasher = crypto.createHash('sha256');
  hasher.update(ldApplication.id!);
  ldApplication.key = hasher.digest('base64');

  const ldDevice = clone<LDDevice>(ld_device);
  if (ld_device && !ld_device.key) {
    ldDevice.key = await getOrGenerateKey('ld_device', platform);
  }

  return { ...multi, ld_application, ld_device } as LDMultiKindContext;
};

export default injectAutoEnv;
