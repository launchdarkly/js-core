import { Hasher } from '@launchdarkly/js-sdk-common';

export default function digest(hasher: Hasher, encoding: string) {
  if (hasher.digest) {
    return hasher.digest(encoding);
  }
  if (hasher.asyncDigest) {
    return hasher.asyncDigest(encoding);
  }
  // This represents an error in platform implementation.
  throw new Error('Platform must implement digest or asyncDigest');
}
