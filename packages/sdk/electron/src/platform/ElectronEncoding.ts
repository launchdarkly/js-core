import type { Encoding } from '@launchdarkly/js-client-sdk-common';

export default class ElectronEncoding implements Encoding {
  btoa(data: string): string {
    return Buffer.from(data).toString('base64');
  }
}
