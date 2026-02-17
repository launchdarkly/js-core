import { LDLogger } from '@launchdarkly/js-sdk-common';

import { Flag } from '../types';
import { ItemDescriptor } from './ItemDescriptor';

export function readFlagsFromBootstrap(
  logger: LDLogger,
  data: any,
): { [key: string]: ItemDescriptor } {
  // If the bootstrap data came from an older server-side SDK, we'll have just a map of keys to values.
  // Newer SDKs that have an allFlagsState method will provide an extra "$flagsState" key that contains
  // the rest of the metadata we want. We do it this way for backward compatibility with older JS SDKs.
  const keys = Object.keys(data);
  const metadataKey = '$flagsState';
  const validKey = '$valid';
  const metadata = data[metadataKey];
  if (!metadata && keys.length) {
    logger.warn(
      'LaunchDarkly client was initialized with bootstrap data that did not include flag' +
        ' metadata. Events may not be sent correctly.',
    );
  }
  if (data[validKey] === false) {
    logger.warn(
      'LaunchDarkly bootstrap data is not available because the back end could not read the flags.',
    );
  }
  const ret: { [key: string]: ItemDescriptor } = {};
  keys.forEach((key) => {
    if (key !== metadataKey && key !== validKey) {
      let flag: Flag;
      if (metadata && metadata[key]) {
        flag = {
          value: data[key],
          ...metadata[key],
        };
      } else {
        flag = {
          value: data[key],
          version: 0,
        };
      }
      ret[key] = {
        version: flag.version,
        flag,
      };
    }
  });
  return ret;
}
