import { TestHarnessWebSocket as SharedTestHarnessWebSocket } from '@launchdarkly/js-contract-test-utils/client';

import { newSdkClientEntity } from './ClientEntity';

const CAPABILITIES = [
  'client-side',
  'service-endpoints',
  'tags',
  'user-type',
  'inline-context-all',
  'anonymous-redaction',
  'strongly-typed',
  'client-prereq-events',
  'client-per-context-summaries',
  'track-hooks',
];

export default class TestHarnessWebSocket extends SharedTestHarnessWebSocket {
  constructor(url: string) {
    super(url, CAPABILITIES, newSdkClientEntity);
  }
}
