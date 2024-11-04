import { Hasher } from '@launchdarkly/js-client-sdk-common';

export class MockHasher implements Hasher {
  update(_data: string): Hasher {
    return this;
  }
  digest?(_encoding: string): string {
    return 'hashed';
  }
  async asyncDigest?(_encoding: string): Promise<string> {
    return 'hashed';
  }
}
