import type { Encoding } from '@launchdarkly/js-client-sdk-common';

import { btoa } from '../polyfills';

export default class PlatformEncoding implements Encoding {
  btoa(data: string): string {
    return btoa(data);
  }
}
