import type { Encoding } from '@launchdarkly/js-client-sdk-common';

export default class NodeEncoding implements Encoding {
  btoa(data: string): string {
    return Buffer.from(data, 'utf8').toString('base64');
  }
}
